/**
 * Kalo · NutriDelivery — servidor de la API REST (Etapa 2: MongoDB Atlas).
 * La Etapa 1 (SQLite) se retiró del código; su historia queda en el informe.
 */
require('dotenv').config(); // lee .env (este archivo NO se sube a GitHub)

const express = require('express');
const cors = require('cors');
const { conectarMongo } = require('./src/config/mongo');
const { limiteGeneral } = require('./src/middleware/limites');
const { manejarErrores, rutaNoEncontrada } = require('./src/middleware/errores');
const authRoutes = require('./src/Rutas/authRoutes');
const mongoRoutes = require('./src/Rutas/mongoRoutes');

if (!process.env.JWT_SECRET) {
    console.warn('⚠️  Falta JWT_SECRET en el archivo .env. Se usará una clave temporal solo para desarrollo.');
}

const app = express();
conectarMongo();

// Middlewares
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGEN || true }));
app.use(express.json({ limit: '100kb' }));   // límite del cuerpo de cada solicitud
app.use(express.static('public'));

// API REST (todas las rutas bajo /api)
app.use('/api', limiteGeneral);              // 300 solicitudes por IP cada 15 minutos
app.use('/api', authRoutes);                 // /api/login y /api/registro
app.use('/api/mongo', mongoRoutes);          // recursos de MongoDB Atlas

app.use('/api', rutaNoEncontrada);           // 404 en formato JSON
app.use(manejarErrores);                     // 400 JSON mal formado, 413, 500

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Kalo corriendo en http://localhost:${PORT}`);
});
