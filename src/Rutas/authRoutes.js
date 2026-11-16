const express = require('express');
const router = express.Router();
const authController = require('../Controladores/authController');
const { limiteAcceso } = require('../middleware/limites');

// Rutas públicas de autenticación (10 intentos cada 15 minutos por IP)
router.post('/login', limiteAcceso, authController.login);
router.post('/registro', limiteAcceso, authController.registro);

module.exports = router;
