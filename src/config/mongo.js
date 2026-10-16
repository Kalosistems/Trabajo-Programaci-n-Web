const mongoose = require('mongoose');

// Permite conectar a MongoDB Atlas por variable de entorno MONGO_URI
// Si no existe la variable, usa una ruta por defecto
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nutridelivery';

const conectarMongo = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('❌ ERROR CRÍTICO: La variable MONGO_URI no está configurada en las Variables de Entorno.');
        return;
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000
        });
        console.log(' ¡Conexión exitosa a MongoDB Atlas en la nube!');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB Atlas:', error.message);
    }
};

module.exports = { conectarMongo, mongoose };

