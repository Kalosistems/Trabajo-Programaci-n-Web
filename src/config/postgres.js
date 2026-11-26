/**
 * Base de datos RELACIONAL (PostgreSQL en Railway). Kalo usa dos bases al mismo tiempo:
 * - PostgreSQL: lo transaccional y tabular → cuentas (credenciales), sesiones (JWT), pagos y accesos.
 * - MongoDB Atlas: perfiles, catálogo, pedidos, fotos y avisos (documentos).
 *
 * Todas las consultas son PARAMETRIZADAS ("enmascaradas"): los valores van aparte como $1, $2…
 * y nunca se pegan dentro del texto SQL, así no hay inyección SQL.
 */
const { Pool } = require('pg');

const URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
// Railway entrega la conexión interna sin SSL; las conexiones públicas (y otros proveedores) usan SSL
const usaSsl = URL && !/localhost|127\.0\.0\.1|\.railway\.internal/.test(URL) && process.env.PG_SSL !== 'false';

const pool = URL ? new Pool({
    connectionString: URL,
    ssl: usaSsl ? { rejectUnauthorized: false } : false,
    max: 20,                       // conexiones simultáneas (RNF-06)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000
}) : null;

let lista = false;

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS cuentas (
    id             SERIAL PRIMARY KEY,
    mongo_id       CHAR(24)     NOT NULL UNIQUE,
    rol            VARCHAR(12)  NOT NULL CHECK (rol IN ('cliente', 'restaurante', 'repartidor')),
    correo         VARCHAR(254) NOT NULL UNIQUE,
    password_hash  CHAR(60)     NOT NULL,
    activo         BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ultimo_acceso  TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sesiones (
    jti        UUID         PRIMARY KEY,
    cuenta_id  INTEGER      NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    creada_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expira_en  TIMESTAMPTZ  NOT NULL,
    revocada   BOOLEAN      NOT NULL DEFAULT FALSE,
    ip         VARCHAR(45),
    agente     VARCHAR(200)
);
CREATE INDEX IF NOT EXISTS sesiones_cuenta_idx ON sesiones (cuenta_id);
CREATE TABLE IF NOT EXISTS pagos (
    id             SERIAL PRIMARY KEY,
    referencia     VARCHAR(48)   NOT NULL UNIQUE,
    cuenta_id      INTEGER       REFERENCES cuentas(id) ON DELETE SET NULL,
    codigo_pedido  VARCHAR(32)   NOT NULL,
    concepto       VARCHAR(12)   NOT NULL CHECK (concepto IN ('platillos', 'plan')),
    monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    moneda         CHAR(3)       NOT NULL CHECK (moneda IN ('CLP', 'USD')),
    metodo         VARCHAR(10)   NOT NULL CHECK (metodo IN ('credito', 'debito')),
    marca          VARCHAR(20),
    ultimos4       CHAR(4),
    estado         VARCHAR(12)   NOT NULL DEFAULT 'Aprobado' CHECK (estado IN ('Aprobado', 'Reembolsado')),
    creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pagos_pedido_idx ON pagos (codigo_pedido);
CREATE TABLE IF NOT EXISTS accesos (
    id         SERIAL PRIMARY KEY,
    cuenta_id  INTEGER      REFERENCES cuentas(id) ON DELETE SET NULL,
    exito      BOOLEAN      NOT NULL,
    ip         VARCHAR(45),
    fecha      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
`;

async function conectarPostgres() {
    if (!pool) {
        console.error('❌ Falta DATABASE_URL en el archivo .env (PostgreSQL, ver .env.example).');
        return;
    }
    try {
        await pool.query(ESQUEMA); // crea las tablas si no existen
        lista = true;
        const { rows } = await pool.query('SELECT current_database() AS base');
        console.log(`✅ Conectado a PostgreSQL. Base de datos: [${rows[0].base}]`);
    } catch (e) {
        console.error('❌ Error conectando a PostgreSQL:', e.message);
    }
}

pool?.on('error', (e) => console.error('⚠️  Error en la conexión con PostgreSQL:', e.message));

// Consulta parametrizada: consultar('SELECT * FROM cuentas WHERE correo = $1', [correo])
function consultar(texto, valores = []) {
    if (!pool) throw Object.assign(new Error('PostgreSQL no está configurado'), { codigo: 'BD_NO_DISPONIBLE' });
    return pool.query(texto, valores);
}

// Varias consultas en una transacción (BEGIN … COMMIT, o ROLLBACK si algo falla)
async function transaccion(trabajo) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const r = await trabajo((texto, valores = []) => cliente.query(texto, valores));
        await cliente.query('COMMIT');
        return r;
    } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
    } finally {
        cliente.release();
    }
}

const postgresListo = () => !!pool && lista;
const estadoPostgres = () => (postgresListo() ? 'conectada' : 'desconectada');
const cerrarPostgres = () => pool?.end();

module.exports = { conectarPostgres, consultar, transaccion, postgresListo, estadoPostgres, cerrarPostgres };
