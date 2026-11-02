const express = require('express');
const router = express.Router();
const mongoController = require('../Controladores/mongoController');

// Rutas de consultas NoSQL en MongoDB Atlas (en español y coherentes)
router.get('/platillos', mongoController.obtenerPlatillos);
router.get('/platillos-fit', mongoController.obtenerPlatillosLigeros);
router.get('/platillos-con-restaurante', mongoController.obtenerPlatillosConRestaurante);
router.get('/estadisticas', mongoController.obtenerEstadisticasBiometricas);
router.get('/pedidos', mongoController.obtenerPedidos);
router.post('/pedidos', mongoController.crearPedido);
router.post('/pedidos/validar-pin', mongoController.validarPinEntrega);

module.exports = router;
