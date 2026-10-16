require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { conectarMongo } = require('./src/config/mongo');
const Usuario = require('./src/Modelos/mongo/Usuario');
const PlanNutricionalMongo = require('./src/Modelos/mongo/PlanNutricional');
const authRoutes = require('./src/Rutas/authRoutes');
const consultaRoutes = require('./src/Rutas/consultaRoutes');

const app = express();

// Iniciar conexión con MongoDB Atlas
conectarMongo();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Ruta de prueba para verificar conexión a MongoDB Atlas
app.get('/api/mongo/test', async (req, res) => {
    try {
        const planes = await PlanNutricionalMongo.find();
        const usuarios = await Usuario.find();
        res.json({
            exito: true,
            mensaje: '¡Conexión a MongoDB Atlas exitosa!',
            totalPlanes: planes.length,
            totalUsuarios: usuarios.length,
            planes,
            usuarios
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
});

const mongoRoutes = require('./src/Rutas/mongoRoutes');

// Rutas modularizadas bajo el prefijo /api
app.use('/api', authRoutes);
app.use('/api/consultas', consultaRoutes);
app.use('/api/mongo', mongoRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});

