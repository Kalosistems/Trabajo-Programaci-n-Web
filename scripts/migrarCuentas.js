/**
 * Migración única (npm run migrar-cuentas): pasa las credenciales de MongoDB a PostgreSQL.
 * - Por cada documento de usuarios, restaurantes y repartidores crea su fila en la tabla cuentas
 *   (correo, rol y hash bcrypt) y quita el password_hash del documento de MongoDB.
 * - Anota en la tabla pagos los pedidos que ya tenían un pago.
 * No borra perfiles ni pedidos. Se puede ejecutar varias veces (ON CONFLICT DO NOTHING).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { conectarMongo, mongoose } = require('../src/config/mongo');
const { conectarPostgres, consultar, postgresListo, cerrarPostgres } = require('../src/config/postgres');

const ES_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const COLECCIONES = { usuarios: 'cliente', restaurantes: 'restaurante', repartidores: 'repartidor' };

(async () => {
    await conectarMongo();
    await conectarPostgres();
    if (mongoose.connection.readyState !== 1 || !postgresListo()) throw new Error('Revisa MONGO_URI y DATABASE_URL en el .env.');
    const db = mongoose.connection.db;
    let creadas = 0, sinClave = 0;

    for (const [coleccion, rol] of Object.entries(COLECCIONES)) {
        for await (const doc of db.collection(coleccion).find({}, { projection: { correo: 1, password_hash: 1 } })) {
            let hash = doc.password_hash;
            if (!hash) {
                const { rowCount } = await consultar('SELECT 1 FROM cuentas WHERE mongo_id = $1', [String(doc._id)]);
                if (!rowCount) { sinClave++; console.warn(`⚠️  ${doc.correo}: no tiene contraseña; deberá registrarse de nuevo.`); }
                continue;
            }
            if (!ES_BCRYPT.test(hash)) hash = await bcrypt.hash(String(hash), 10); // quedaba en texto plano
            const r = await consultar(
                `INSERT INTO cuentas (mongo_id, rol, correo, password_hash) VALUES ($1, $2, $3, $4)
                 ON CONFLICT DO NOTHING`,
                [String(doc._id), rol, String(doc.correo).toLowerCase(), hash]
            );
            creadas += r.rowCount;
            await db.collection(coleccion).updateOne({ _id: doc._id }, { $unset: { password_hash: '' } });
        }
    }

    let pagosAnotados = 0;
    for await (const p of db.collection('pedidos').find({ 'pago.referencia': { $exists: true } }, { projection: { codigo_pedido: 1, total: 1, tipo: 1, pago: 1, 'cliente.usuario_id': 1 } })) {
        const { rows } = await consultar('SELECT id FROM cuentas WHERE mongo_id = $1', [String(p.cliente.usuario_id)]);
        const r = await consultar(
            `INSERT INTO pagos (referencia, cuenta_id, codigo_pedido, concepto, monto, moneda, metodo, marca, ultimos4, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
            [p.pago.referencia, rows[0]?.id || null, p.codigo_pedido, p.tipo === 'plan' ? 'plan' : 'platillos', p.total,
                p.tipo === 'plan' ? 'USD' : 'CLP', p.pago.metodo || 'credito', p.pago.marca, p.pago.ultimos4, p.pago.estado || 'Aprobado']
        );
        pagosAnotados += r.rowCount;
    }

    console.log(`✅ ${creadas} cuenta(s) creadas en PostgreSQL, ${pagosAnotados} pago(s) anotados${sinClave ? `, ${sinClave} sin contraseña` : ''}.`);
    await mongoose.disconnect();
    await cerrarPostgres();
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
