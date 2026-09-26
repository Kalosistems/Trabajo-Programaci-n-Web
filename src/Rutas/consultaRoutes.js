const express = require('express');
const router = express.Router();
const consultaController = require('../Controladores/consultaController');

// 1. SELECT simple: Listar clientes
router.get('/clientes', consultaController.getClientes);

// 2. SELECT con WHERE y ORDER BY: Planes nutricionales
router.get('/planes', consultaController.getPlanes);

// 3. SELECT con funciones de agregación (COUNT, AVG)
router.get('/estadisticas', consultaController.getEstadisticasClientes);

// 4. INSERT cliente
router.post('/clientes', consultaController.insertCliente);

// 5. INSERT pedido
router.post('/pedidos', consultaController.insertPedido);

// 6. UPDATE datos de cliente (peso, altura)
router.put('/clientes', consultaController.updateCliente);

// 7. UPDATE estado de pedido
router.put('/pedidos/estado', consultaController.updateEstadoPedido);

// 8. JOIN (INNER): Pedido con Cliente y Plan
router.get('/pedidos-detallados', consultaController.getPedidosDetallados);

// 9. JOIN (LEFT): Clientes con o sin pedidos
router.get('/clientes-pedidos', consultaController.getClientesConOPedidos);

// 10. DELETE pedido
router.delete('/pedidos/ultimo', consultaController.deleteUltimoPedido);

// 11. ALTER TABLE: Agregar columna
router.post('/alter-table', consultaController.alterTableAgregarTelefono);

// 12. CREATE TABLE auxiliar
router.post('/crear-tabla-auditoria', consultaController.crearTablaAuditoria);

// 13. DROP TABLE auxiliar
router.delete('/drop-tabla-auditoria', consultaController.dropTablaAuditoria);

// Estado general de la base de datos
router.get('/estado', consultaController.getEstadoTablas);

module.exports = router;
