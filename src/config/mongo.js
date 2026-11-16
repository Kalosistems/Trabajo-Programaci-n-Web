// Algunas redes (universidad, celular) no resuelven bien los registros SRV de Atlas:
// se usan DNS públicos para la cadena mongodb+srv://
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');

const conectarMongo = async () => {
    const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();
    if (!mongoUri) {
        console.error('❌ Falta MONGO_URI en el archivo .env (ver .env.example).');
        return;
    }
    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
        console.log(`✅ Conectado a MongoDB. Base de datos: [${mongoose.connection.name}]`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
    }
};

module.exports = { conectarMongo, mongoose };
