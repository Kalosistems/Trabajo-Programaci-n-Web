const express = require('express');
const router = express.Router();
const c = require('../Controladores/mongoController');
const cli = require('../Controladores/clienteController');
const rest = require('../Controladores/restauranteController');
const av = require('../Controladores/avisosController');
const { verificarToken, permitirRoles } = require('../middleware/auth');
const { limitePin } = require('../middleware/limites');

const sesion = verificarToken;                       // 401 si no hay token válido
const cliente = permitirRoles('cliente');            // 403 si el rol no corresponde
const restaurante = permitirRoles('restaurante');
const repartidor = permitirRoles('repartidor');

// ── Públicas (catálogo) ─────────────────────────────────────────────
router.get('/platillos', c.obtenerPlatillos);                         // RF-04 filtros + RF-11 ranking
router.get('/platillos-fit', c.obtenerPlatillosLigeros);              // $lte
router.get('/platillos-con-restaurante', c.obtenerPlatillosConRestaurante); // $lookup (JOIN)
router.get('/planes', c.obtenerPlanes);                               // WHERE + ORDER BY ($gt, sort)
router.get('/restaurantes', rest.listarRestaurantes);                 // RF-11 ranking de locales
router.get('/restaurantes/fotos/:id', rest.imagenFoto);               // RF-07 imagen de la galería
router.get('/nutricion/alimentos', av.alimentos);                     // RF-08 tabla de alimentos
router.post('/nutricion/calcular', av.calcular);                      // RF-08 cálculo nutricional

// ── Con sesión ──────────────────────────────────────────────────────
router.get('/estadisticas', sesion, c.obtenerEstadisticasBiometricas);    // $group (GROUP BY)
router.get('/usuarios', sesion, c.obtenerUsuarios);                       // proyección sin datos sensibles
router.get('/usuarios-pedidos', sesion, c.obtenerUsuariosConPedidos);     // $lookup (LEFT JOIN)
router.get('/pedidos', sesion, c.obtenerPedidos);                         // filtrado según el rol del token
router.get('/notificaciones', sesion, av.misNotificaciones);              // RF-12, RF-20, RF-23
router.put('/notificaciones/leidas', sesion, av.marcarLeidas);

// Cliente
router.post('/pedidos', sesion, cliente, c.crearPedido);                  // con pago de la pasarela (RNF-07)
router.post('/pedidos/evaluar', sesion, cliente, c.evaluarPedido);        // RF-12..14
router.get('/usuarios/consumo', sesion, cliente, cli.consumoDelDia);      // RF-03
router.put('/usuarios/biometrico', sesion, cliente, c.actualizarPerfilBiometrico);
router.delete('/usuarios/:usuario_id', sesion, cliente, c.eliminarUsuario);
router.post('/planes/contratar', sesion, cliente, cli.contratarPlan);     // RF-21
router.delete('/planes/contrato', sesion, cliente, cli.cancelarPlan);     // RF-21

// Restaurante
router.get('/platillos/mios', sesion, restaurante, rest.misPlatillos);
router.post('/platillos', sesion, restaurante, c.crearPlatillo);          // RF-06, RF-08, RF-09
router.put('/platillos/:id/estado', sesion, restaurante, rest.cambiarEstadoPlatillo);
router.put('/pedidos/estado', sesion, restaurante, c.actualizarEstadoPedido); // aceptar, rechazar, despachar (PIN)
router.get('/repartidores', sesion, restaurante, c.obtenerRepartidores);
router.get('/restaurantes/mi-local', sesion, restaurante, rest.verMiLocal);
router.put('/restaurantes/mi-local', sesion, restaurante, c.actualizarMiLocal);
router.post('/restaurantes/fotos', sesion, restaurante, rest.subirFotoCocina);       // RF-07
router.delete('/restaurantes/fotos/:id', sesion, restaurante, rest.eliminarFotoCocina);

// Repartidor
router.put('/pedidos/aceptar', sesion, repartidor, c.aceptarPedido);
router.put('/pedidos/cerca', sesion, repartidor, c.avisarCercania);       // RF-23
router.put('/repartidores/disponibilidad', sesion, repartidor, c.cambiarDisponibilidad);
router.post('/pedidos/validar-pin', limitePin, sesion, repartidor, c.validarPinEntrega);

// Perfil público de un local (va al final para que "mi-local" no se lea como un :id)
router.get('/restaurantes/:id', rest.perfilRestaurante);                  // RF-07 galería pública

module.exports = router;
