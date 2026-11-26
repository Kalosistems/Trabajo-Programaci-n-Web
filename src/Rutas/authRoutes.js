const express = require('express');
const router = express.Router();
const authController = require('../Controladores/authController');
const { limiteAcceso } = require('../middleware/limites');
const { verificarToken } = require('../middleware/auth');

// Rutas públicas de autenticación (10 intentos cada 15 minutos por IP)
router.post('/login', limiteAcceso, authController.login);
router.post('/registro', limiteAcceso, authController.registro);
router.post('/logout', verificarToken, authController.logout);       // revoca la sesión en PostgreSQL
router.get('/sesion', verificarToken, authController.sesionActual);   // ¿quién está conectado? (cookie httpOnly)

module.exports = router;
