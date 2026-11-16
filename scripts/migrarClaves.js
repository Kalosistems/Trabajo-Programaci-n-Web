/**
 * Migración única (npm run migrar-claves):
 * convierte en hash bcrypt las contraseñas que quedaron guardadas en texto plano
 * en usuarios, restaurantes y repartidores (cuentas creadas antes de esta corrección).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { conectarMongo, mongoose } = require('../src/config/mongo');

const ES_BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function migrar() {
    await conectarMongo();
    if (mongoose.connection.readyState !== 1) process.exit(1);
    const db = mongoose.connection.db;
    let convertidas = 0, invalidas = 0;

    for (const nombre of ['usuarios', 'restaurantes', 'repartidores']) {
        const cursor = db.collection(nombre).find({}, { projection: { correo: 1, password_hash: 1 } });
        for await (const doc of cursor) {
            const actual = doc.password_hash || '';
            if (ES_BCRYPT.test(actual)) continue;            // ya está en hash
            if (actual.startsWith('$2')) {                    // hash falso de los datos antiguos
                invalidas++;
                console.warn(`⚠️  ${nombre} · ${doc.correo}: hash no válido. Vuelve a cargar los datos con "npm run seed" o registra la cuenta de nuevo.`);
                continue;
            }
            const hash = await bcrypt.hash(actual, 10);       // texto plano → hash
            await db.collection(nombre).updateOne({ _id: doc._id }, { $set: { password_hash: hash } });
            convertidas++;
        }
    }
    console.log(`✅ Contraseñas convertidas a bcrypt: ${convertidas}. Con hash no válido: ${invalidas}.`);
    await mongoose.disconnect();
}

migrar().catch(e => { console.error(e); process.exit(1); });
