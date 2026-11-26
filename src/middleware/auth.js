/**
 * Autenticación (JWT) y autorización por rol.
 * - El token viaja en una cookie httpOnly "kalo_sesion": el JavaScript del navegador no puede leerlo,
 *   no se guarda en localStorage y no aparece en el JSON de las respuestas.
 * - Cada token tiene un identificador (jti) guardado en la tabla sesiones de PostgreSQL. En cada
 *   solicitud se verifica la firma del token Y que esa sesión siga vigente en la base relacional
 *   (cerrar sesión la revoca al instante).
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sesionValida } = require('../Modelos/sql/cuentas');
const { postgresListo } = require('../config/postgres');

// En desarrollo, si falta JWT_SECRET se genera una clave al azar (los tokens mueren al reiniciar).
const SECRETO = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const EXPIRA = process.env.JWT_EXPIRA || '8h';
const COOKIE = 'kalo_sesion';
const DURACION_MS = 8 * 60 * 60 * 1000;

function firmarToken({ mongoId, rol, nombre, cuentaId }) {
    const jti = crypto.randomUUID();
    const token = jwt.sign({ sub: String(mongoId), rol, nombre, cid: cuentaId }, SECRETO, { expiresIn: EXPIRA, jwtid: jti });
    const { exp } = jwt.decode(token);
    return { token, jti, expiraEn: new Date(exp * 1000) };
}

// Cookie de sesión: httpOnly (JS no la lee), SameSite=Strict (no viaja desde otros sitios)
// y Secure en HTTPS (Railway)
function opcionesCookie(req) {
    return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/api', maxAge: DURACION_MS };
}
function ponerCookie(req, res, token) { res.cookie(COOKIE, token, opcionesCookie(req)); }
function borrarCookie(req, res) { const { maxAge, ...o } = opcionesCookie(req); res.clearCookie(COOKIE, o); }

const noAutenticado = (res, codigo, mensaje) => res.status(401).json({ exito: false, codigo, mensaje });

async function verificarToken(req, res, next) {
    const token = req.cookies?.[COOKIE];
    if (!token) return noAutenticado(res, 'NO_AUTENTICADO', 'Debes iniciar sesión para usar esta función.');
    let datos;
    try {
        datos = jwt.verify(token, SECRETO);
    } catch (e) {
        borrarCookie(req, res);
        const vencido = e.name === 'TokenExpiredError';
        return noAutenticado(res, vencido ? 'SESION_VENCIDA' : 'TOKEN_INVALIDO',
            vencido ? 'Tu sesión venció. Inicia sesión de nuevo.' : 'La sesión no es válida. Inicia sesión de nuevo.');
    }
    if (!postgresListo()) {
        return res.status(503).json({ exito: false, codigo: 'BD_NO_DISPONIBLE', mensaje: 'No pudimos verificar tu sesión en este momento. Intenta de nuevo.' });
    }
    try {
        const sesion = await sesionValida(datos.jti);
        if (!sesion || sesion.mongo_id !== datos.sub) {
            borrarCookie(req, res);
            return noAutenticado(res, 'SESION_CERRADA', 'Tu sesión se cerró. Inicia sesión de nuevo.');
        }
        // id = el del perfil en MongoDB; cuentaId = el de la cuenta en PostgreSQL
        req.usuario = { id: sesion.mongo_id, rol: sesion.rol, nombre: datos.nombre, cuentaId: sesion.cuenta_id, jti: datos.jti };
        next();
    } catch (e) {
        next(e);
    }
}

// permitirRoles('cliente', 'restaurante') → 403 si el rol del token no está en la lista
function permitirRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.usuario.rol)) {
            return res.status(403).json({ exito: false, codigo: 'SIN_PERMISO', mensaje: `Esta acción es solo para: ${roles.join(', ')}.` });
        }
        next();
    };
}

module.exports = { firmarToken, verificarToken, permitirRoles, ponerCookie, borrarCookie, EXPIRA, COOKIE };
