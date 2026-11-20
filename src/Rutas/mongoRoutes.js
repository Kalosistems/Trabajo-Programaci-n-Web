const express = require('express');
const router = express.Router();
const c = require('../Controladores/mongoController');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { limitePin } = require('../middleware/limites');

const sesion = verificarToken;                       // 401 si no hay token válido
const cliente = permitirRoles('cliente');            // 403 si el rol no corresponde
const restaurante = permitirRoles('restaurante');
const repartidor = permitirRoles('repartidor');

// ── Públicas (catálogo) ─────────────────────────────────────────────
router.get('/platillos', c.obtenerPlatillos);                         // find + filtros ($regex, $lte, $gte)
router.get('/platillos-fit', c.obtenerPlatillosLigeros);              // $lte
router.get('/platillos-con-restaurante', c.obtenerPlatillosConRestaurante); // $lookup (JOIN)
router.get('/planes', c.obtenerPlanes);                               // WHERE + ORDER BY ($gt, sort)

// ── Con sesión ──────────────────────────────────────────────────────
router.get('/estadisticas', sesion, c.obtenerEstadisticasBiometricas);    // $group (GROUP BY)
router.get('/usuarios', sesion, c.obtenerUsuarios);                       // proyección sin datos sensibles
router.get('/usuarios-pedidos', sesion, c.obtenerUsuariosConPedidos);     // $lookup (LEFT JOIN)
router.get('/pedidos', sesion, c.obtenerPedidos);                         // filtrado según el rol del token

// Cliente
router.post('/pedidos', sesion, cliente, c.crearPedido);
router.post('/pedidos/evaluar', sesion, cliente, c.evaluarPedido);
router.put('/usuarios/biometrico', sesion, cliente, c.actualizarPerfilBiometrico);
router.delete('/usuarios/:usuario_id', sesion, cliente, c.eliminarUsuario);

// Restaurante
router.post('/platillos', sesion, restaurante, c.crearPlatillo);
router.put('/pedidos/estado', sesion, restaurante, c.actualizarEstadoPedido); // al despachar genera el PIN
router.get('/repartidores', sesion, restaurante, c.obtenerRepartidores);
router.put('/restaurantes/mi-local', sesion, restaurante, c.actualizarMiLocal);

// Repartidor
router.put('/pedidos/aceptar', sesion, repartidor, c.aceptarPedido);
router.post('/pedidos/validar-pin', limitePin, sesion, repartidor, c.validarPinEntrega);

module.exports = router;
