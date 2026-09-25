const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/Rutas/authRoutes');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Rutas modularizadas bajo el prefijo /api
app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Backend corriendo en http://localhost:${PORT}`);
});
