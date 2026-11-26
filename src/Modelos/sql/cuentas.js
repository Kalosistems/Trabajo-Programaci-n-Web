/**
 * Cuentas, sesiones y accesos en PostgreSQL. Consultas parametrizadas ($1, $2…):
 * los valores que escribe el usuario nunca forman parte del texto SQL.
 */
const { consultar, transaccion } = require('../../config/postgres');

// Login: la cuenta se busca SOLO por correo; la contraseña se compara después con bcrypt
async function buscarPorCorreo(correo) {
    const { rows } = await consultar(
        'SELECT id, mongo_id, rol, correo, password_hash, activo FROM cuentas WHERE correo = $1',
        [correo]
    );
    return rows[0] || null;
}

async function existeCorreo(correo) {
    const { rowCount } = await consultar('SELECT 1 FROM cuentas WHERE correo = $1', [correo]);
    return rowCount > 0;
}

async function crearCuenta({ mongo_id, rol, correo, password_hash }) {
    const { rows } = await consultar(
        `INSERT INTO cuentas (mongo_id, rol, correo, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, mongo_id, rol, correo`,
        [String(mongo_id), rol, correo, password_hash]
    );
    return rows[0];
}

// Auditoría de inicios de sesión (exitosos y fallidos)
async function registrarAcceso(cuentaId, exito, ip) {
    await consultar('INSERT INTO accesos (cuenta_id, exito, ip) VALUES ($1, $2, $3)', [cuentaId, exito, ip ? String(ip).slice(0, 45) : null]);
    if (exito && cuentaId) await consultar('UPDATE cuentas SET ultimo_acceso = now() WHERE id = $1', [cuentaId]);
}

// Cada token JWT tiene una fila en sesiones (su jti). Cerrar sesión la revoca.
async function crearSesion({ jti, cuentaId, expiraEn, ip, agente }) {
    await consultar(
        'INSERT INTO sesiones (jti, cuenta_id, expira_en, ip, agente) VALUES ($1, $2, $3, $4, $5)',
        [jti, cuentaId, expiraEn, ip ? String(ip).slice(0, 45) : null, agente ? String(agente).slice(0, 200) : null]
    );
}

// Verifica en la base relacional que la sesión del token exista, no esté revocada ni vencida
// y que la cuenta siga activa
async function sesionValida(jti) {
    const { rows } = await consultar(
        `SELECT s.jti, c.id AS cuenta_id, c.mongo_id, c.rol, c.correo
           FROM sesiones s
           JOIN cuentas c ON c.id = s.cuenta_id
          WHERE s.jti = $1 AND s.revocada = FALSE AND s.expira_en > now() AND c.activo = TRUE`,
        [jti]
    );
    return rows[0] || null;
}

async function revocarSesion(jti) {
    await consultar('UPDATE sesiones SET revocada = TRUE WHERE jti = $1', [jti]);
}

// Derecho de supresión (Ley 21.719): se borran la cuenta y sus sesiones (ON DELETE CASCADE).
// Los pagos quedan sin dueño (cuenta_id = NULL) porque son registros contables.
async function eliminarPorMongoId(mongoId) {
    return transaccion(async (q) => {
        const { rows } = await q('SELECT id FROM cuentas WHERE mongo_id = $1', [String(mongoId)]);
        if (!rows[0]) return 0;
        await q('DELETE FROM accesos WHERE cuenta_id = $1', [rows[0].id]);
        const r = await q('DELETE FROM cuentas WHERE id = $1', [rows[0].id]);
        return r.rowCount;
    });
}

module.exports = { buscarPorCorreo, existeCorreo, crearCuenta, registrarAcceso, crearSesion, sesionValida, revocarSesion, eliminarPorMongoId };
