/**
 * Kalo · NutriDelivery — servidor de la API REST (Etapa 2: MongoDB Atlas).
 * La Etapa 1 (SQLite) se retiró del código; su historia queda en el informe.
 */
require('dotenv').config(); // lee .env (este archivo NO se sube a GitHub)

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { conectarMongo, estadoConexion } = require('./src/config/mongo');
const { conectarPostgres, estadoPostgres, cerrarPostgres } = require('./src/config/postgres');
const { sanitizar } = require('./src/middleware/sanitizar');
const { limiteGeneral } = require('./src/middleware/limites');
const { manejarErrores, rutaNoEncontrada } = require('./src/middleware/errores');
const authRoutes = require('./src/Rutas/authRoutes');
const mongoRoutes = require('./src/Rutas/mongoRoutes');

if (!process.env.JWT_SECRET) {
    console.warn('⚠️  Falta JWT_SECRET en el archivo .env. Se usará una clave temporal solo para desarrollo.');
}

const app = express();
conectarMongo();      // base NO relacional: MongoDB Atlas
conectarPostgres();   // base relacional: PostgreSQL (Railway)

// Middlewares
app.disable('x-powered-by');
app.set('trust proxy', 1);                   // Railway pone un proxy delante: la IP real viene en X-Forwarded-For
// Cabeceras de seguridad (Helmet): solo se cargan scripts propios; imágenes propias, data: o https
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'"],
            upgradeInsecureRequests: null // en localhost se usa http; Railway ya entrega HTTPS
        }
    },
    crossOriginEmbedderPolicy: false
}));
app.use(compression());                      // gzip: el catálogo pesa ~70 % menos (RNF-03)
app.use(cors({ origin: process.env.CORS_ORIGEN || true, credentials: true }));
app.use(cookieParser()); // lee la cookie httpOnly de la sesión
// Las rutas que reciben fotos (platillo y cocina) admiten hasta 1 MB: la foto ya viene comprimida
app.use(['/api/mongo/platillos', '/api/mongo/restaurantes/fotos'], express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));   // límite del cuerpo del resto de las solicitudes

// Frontend en React + Bootstrap, compilado con "npm run build" en frontend/dist
const FRONT = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(FRONT, { index: false, maxAge: '1h' }));

// Estado del servicio (RNF-04): lo consulta el monitor de disponibilidad de Railway / UptimeRobot.
// Va antes del límite de solicitudes para que el monitor nunca reciba 429.
app.get('/api/salud', (req, res) => {
    const mongo = estadoConexion();
    const postgres = estadoPostgres();
    const ok = mongo === 'conectada' && postgres === 'conectada';
    res.status(ok ? 200 : 503).json({
        exito: ok, servicio: 'kalo-api', mongodb: mongo, postgresql: postgres,
        activo_desde_s: Math.round(process.uptime()), fecha: new Date().toISOString()
    });
});

// API REST (todas las rutas bajo /api)
app.use('/api', sanitizar);                  // rechaza claves "$..." (inyección NoSQL)
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
const servidor = app.listen(PORT, () => {
    console.log(`Servidor Kalo corriendo en http://localhost:${PORT}`);
});

// Disponibilidad (RNF-04): un error inesperado se registra y no apaga el servidor,
// y al detenerlo (redeploy en Railway) se terminan las solicitudes en curso.
process.on('unhandledRejection', (e) => console.error('Promesa rechazada sin manejar:', e));
process.on('SIGTERM', () => {
    console.log('Cerrando el servidor…');
    servidor.close(async () => { await cerrarPostgres(); process.exit(0); });
    setTimeout(() => process.exit(0), 10000).unref();
});
