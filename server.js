/**
 * Kalo · NutriDelivery — servidor de la API REST (Etapa 2: MongoDB Atlas).
 * La Etapa 1 (SQLite) se retiró del código; su historia queda en el informe.
 */
require('dotenv').config(); // lee .env (este archivo NO se sube a GitHub)

const path = require('path');
const fs = require('fs');
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
// Crear platillo admite hasta 1 MB porque lleva la foto subida (ya comprimida en el navegador)
app.use('/api/mongo/platillos', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));   // límite del cuerpo del resto de las solicitudes

// Frontend en React + Bootstrap, compilado con "npm run build" en frontend/dist
const FRONT = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(FRONT, { index: false, maxAge: '1h' }));

// API REST (todas las rutas bajo /api)
app.use('/api', limiteGeneral);              // 300 solicitudes por IP cada 15 minutos
app.use('/api', authRoutes);                 // /api/login y /api/registro
app.use('/api/mongo', mongoRoutes);          // recursos de MongoDB Atlas

app.use('/api', rutaNoEncontrada);           // 404 en formato JSON

// Cualquier otra ruta GET (/explorar, /local/pedidos, ...) la resuelve React Router
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const indice = path.join(FRONT, 'index.html');
    if (fs.existsSync(indice)) return res.sendFile(indice);
    res.status(503).send('El frontend no está compilado. Ejecuta "npm run build" y vuelve a iniciar el servidor.');
});
app.use(manejarErrores);                     // 400 JSON mal formado, 413, 500

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Kalo corriendo en http://localhost:${PORT}`);
});
