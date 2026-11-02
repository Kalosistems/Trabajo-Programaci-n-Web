const express = require('express');
const router = express.Router();
const mongoController = require('../Controladores/mongoController');

// Rutas de consultas NoSQL en MongoDB Atlas
router.get('/platillos', mongoController.obtenerPlatillos);
router.get('/platillos-fit', mongoController.obtenerPlatillosLigeros);
router.post('/platillos', mongoController.crearPlatillo); // Crear platillo (Restaurante)
router.get('/platillos-con-restaurante', mongoController.obtenerPlatillosConRestaurante); // JOIN NoSQL
router.get('/estadisticas', mongoController.obtenerEstadisticasBiometricas); // GROUP BY NoSQL
router.get('/pedidos', mongoController.obtenerPedidos);
router.post('/pedidos', mongoController.crearPedido); // Crear pedido (Carrito Cliente)
router.put('/pedidos/aceptar', mongoController.aceptarPedido); // Aceptar pedido (Repartidor)
router.post('/pedidos/validar-pin', mongoController.validarPinEntrega); // Validar PIN (Repartidor)

module.exports = router;
