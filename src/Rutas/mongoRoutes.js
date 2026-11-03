const express = require('express');
const router = express.Router();
const mongoController = require('../Controladores/mongoController');

// Catálogo y platillos
router.get('/platillos', mongoController.obtenerPlatillos);
router.get('/platillos-fit', mongoController.obtenerPlatillosLigeros);
router.post('/platillos', mongoController.crearPlatillo);
router.get('/platillos-con-restaurante', mongoController.obtenerPlatillosConRestaurante);

// Estadísticas biométricas NoSQL
router.get('/estadisticas', mongoController.obtenerEstadisticasBiometricas);

// Pedidos y flujo de compra
router.get('/pedidos', mongoController.obtenerPedidos);
router.post('/pedidos', mongoController.crearPedido);
router.put('/pedidos/estado', mongoController.actualizarEstadoPedido);
router.put('/pedidos/aceptar', mongoController.aceptarPedido);
router.post('/pedidos/validar-pin', mongoController.validarPinEntrega);
router.post('/pedidos/evaluar', mongoController.evaluarPedido);

// Repartidores y Restaurantes
router.get('/repartidores', mongoController.obtenerRepartidores);
router.put('/restaurantes/mi-local', mongoController.actualizarMiLocal);

// Planes nutricionales y perfil biométrico
router.get('/planes', mongoController.obtenerPlanes);
router.put('/usuarios/biometrico', mongoController.actualizarPerfilBiometrico);
router.delete('/usuarios/:usuario_id', mongoController.eliminarUsuario);

module.exports = router;
