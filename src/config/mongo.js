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
        // maxPoolSize: hasta 50 conexiones simultáneas a Atlas para atender muchos usuarios a la vez (RNF-06)
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 50 });
        console.log(`✅ Conectado a MongoDB. Base de datos: [${mongoose.connection.name}]`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
    }
};

// Si Atlas se desconecta, Mongoose reintenta solo; aquí solo se deja registro (RNF-04)
mongoose.connection.on('disconnected', () => console.warn('⚠️  Se perdió la conexión con MongoDB. Reintentando…'));
mongoose.connection.on('reconnected', () => console.log('✅ Reconectado a MongoDB'));

const ESTADOS = ['desconectada', 'conectada', 'conectando', 'desconectando'];
const estadoConexion = () => ESTADOS[mongoose.connection.readyState] || 'desconocida';

module.exports = { conectarMongo, mongoose, estadoConexion };
