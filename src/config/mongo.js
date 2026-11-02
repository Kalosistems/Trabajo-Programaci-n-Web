const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');

const conectarMongo = async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ ERROR CRÍTICO: La variable MONGO_URI no está configurada en las Variables de Entorno.');
        return;
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 8000
        });
        console.log('✅ ¡Conexión exitosa a MongoDB Atlas en la nube!');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB Atlas:', error.message);
    }
};

module.exports = { conectarMongo, mongoose };
