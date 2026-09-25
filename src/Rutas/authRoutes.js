const express = require('express');
const router = express.Router();
const authController = require('../Controladores/authController');

// Ruta modularizada para el login
router.post('/login', authController.login);

module.exports = router;
