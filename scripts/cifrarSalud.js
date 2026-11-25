/**
 * Cifra los datos de salud de las cuentas que ya existían en Atlas (npm run cifrar-salud).
 * También recalcula el IMC y la meta calórica con la fórmula nueva (RF-03).
 * No borra nada: se puede ejecutar varias veces (lo ya cifrado se deja igual).
 */
require('dotenv').config();
const { conectarMongo, mongoose } = require('../src/config/mongo');
const Usuario = require('../src/Modelos/mongo/Usuario');
const { armarPerfil } = require('../src/utils/perfil');
const { estaCifrado } = require('../src/utils/cifrado');

(async () => {
    await conectarMongo();
    if (mongoose.connection.readyState !== 1) throw new Error('No hay conexión con MongoDB (revisa MONGO_URI).');
    const crudos = await Usuario.collection.find({}, { projection: { perfil_biometrico: 1 } }).toArray();
    let cifrados = 0;
    for (const crudo of crudos) {
        if (estaCifrado(crudo.perfil_biometrico?.peso_kg)) continue;
        const u = await Usuario.findById(crudo._id);
        const anterior = u.perfil_biometrico.toObject();
        const { perfil, error } = armarPerfil({}, anterior);
        if (error) { console.warn(`⚠️  ${u.correo}: ${error}`); continue; }
        if (u.plan_activo?.calorias_diarias) perfil.meta_calorica_diaria = u.plan_activo.calorias_diarias;
        u.perfil_biometrico = perfil;
        await u.save();
        cifrados++;
    }
    console.log(`✅ ${cifrados} perfil(es) cifrado(s) de ${crudos.length} cuenta(s).`);
    await mongoose.disconnect();
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
