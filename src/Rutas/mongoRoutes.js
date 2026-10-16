const express = require('express');
const router = express.Router();
const mongoController = require('../Controladores/mongoController');

// Rutas de consultas NoSQL en MongoDB Atlas
router.get('/usuarios', mongoController.getUsuarios);
router.get('/planes', mongoController.getPlanes);
router.get('/pedidos-sin-join', mongoController.getPedidosSinJoin);
router.get('/estadisticas', mongoController.getEstadisticasBiometricas);
router.post('/pedidos', mongoController.crearPedido);
router.put('/usuarios/peso', mongoController.actualizarPesoUsuario);

module.exports = router;

