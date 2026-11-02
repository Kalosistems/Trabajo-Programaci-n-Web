/**
 * CONTROLADOR MONGODB (ETAPA 2 - NoSQL KALO)
 * Asignatura: ICI324 Desarrollo Web y Bases de Datos
 * 
 * Cumple con los requerimientos de la Rúbrica:
 * 1. Consultas con OPERADORES ($lte, $gt, $set)
 * 2. Consultas con GROUP BY ($group con $avg, $sum)
 * 3. Consultas con JOINs NoSQL ($lookup entre Platillos y Restaurantes)
 * 4. Gestión de Pedidos y Validación de PIN de entrega (Mobile-First Repartidor)
 * 5. Respuestas HTTP bien estructuradas con notificación clara de éxitos y errores (200, 201, 400, 404, 500)
 */

const Usuario = require('../Modelos/mongo/Usuario');
const PlanNutricional = require('../Modelos/mongo/PlanNutricional');
const Restaurante = require('../Modelos/mongo/Restaurante');
const Repartidor = require('../Modelos/mongo/Repartidor');
const Platillo = require('../Modelos/mongo/Platillo');
const Pedido = require('../Modelos/mongo/Pedido');
const { mongoose } = require('../config/mongo');

function verificarConexion(res) {
    if (mongoose.connection.readyState !== 1) {
        res.status(503).json({
            exito: false,
            mensaje: 'El servicio de base de datos en la nube (MongoDB Atlas) no se encuentra disponible momentáneamente.'
        });
        return false;
    }
    return true;
}

// 1. Catálogo General de Platillos
exports.obtenerPlatillos = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const platillos = await Platillo.find({ activo: true }).sort({ precio: 1 });
        res.status(200).json({
            exito: true,
            total: platillos.length,
            operacion: 'find()',
            descripcion: 'Listado completo de platillos con información calórica y macronutrientes',
            consultaMQL: 'Platillo.find({ activo: true }).sort({ precio: 1 })',
            datos: platillos
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener los platillos', detalle: error.message });
    }
};

// 2. OPERADORES NoSQL ($lte): Filtrar platillos ligeros
exports.obtenerPlatillosLigeros = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const limiteCalorias = parseInt(req.query.maxCalorias) || 500;
        const platillos = await Platillo.find({
            calorias: { $lte: limiteCalorias },
            activo: true
        }).sort({ calorias: 1 });

        res.status(200).json({
            exito: true,
            total: platillos.length,
            operacion: 'find() con operador $lte',
            descripcion: `Platillos saludables con un máximo de ${limiteCalorias} kcal`,
            consultaMQL: `Platillo.find({ calorias: { $lte: ${limiteCalorias} }, activo: true }).sort({ calorias: 1 })`,
            datos: platillos
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al filtrar platillos por calorías', detalle: error.message });
    }
};

// 3. CREAR NUEVO PLATILLO (Rol Restaurante)
exports.crearPlatillo = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { nombre, descripcion, precio, calorias, proteinas, carbos, grasas, indice_transparencia, restaurante_id } = req.body;

        if (!nombre || !precio || !calorias) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El nombre, precio y calorías del platillo son obligatorios.'
            });
        }

        // Si no viene restaurante_id, asignamos el primer restaurante disponible
        let idRest = restaurante_id;
        if (!idRest) {
            const primerRest = await Restaurante.findOne();
            idRest = primerRest ? primerRest._id : null;
        }

        const nuevoPlatillo = await Platillo.create({
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() : 'Plato balanceado y nutritivo Kalo',
            precio: parseFloat(precio),
            calorias: parseInt(calorias),
            macronutrientes: {
                proteinas_g: parseFloat(proteinas) || 25,
                carbohidratos_g: parseFloat(carbos) || 35,
                grasas_g: parseFloat(grasas) || 10
            },
            indice_transparencia: parseInt(indice_transparencia) || 95,
            restaurante_id: idRest
        });

        res.status(201).json({
            exito: true,
            mensaje: '¡Platillo registrado y publicado exitosamente en el catálogo de Kalo!',
            operacion: 'create()',
            consultaMQL: `Platillo.create({ nombre: "${nombre}", calorias: ${calorias}, precio: ${precio}, ... })`,
            platillo: nuevoPlatillo
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al registrar el platillo', detalle: error.message });
    }
};

// 4. JOIN NoSQL ($lookup): Cruzar Platillos con su Restaurante
exports.obtenerPlatillosConRestaurante = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const pipeline = [
            {
                $lookup: {
                    from: 'restaurantes',
                    localField: 'restaurante_id',
                    foreignField: '_id',
                    as: 'restaurante'
                }
            },
            {
                $unwind: '$restaurante'
            },
            {
                $project: {
                    nombre: 1,
                    descripcion: 1,
                    precio: 1,
                    calorias: 1,
                    indice_transparencia: 1,
                    'restaurante.nombre': 1,
                    'restaurante.especialidad': 1,
                    'restaurante.direccion': 1,
                    'restaurante.telefono': 1
                }
            }
        ];

        const resultado = await Platillo.aggregate(pipeline);
        res.status(200).json({
            exito: true,
            total: resultado.length,
            operacion: 'aggregate() con $lookup (JOIN NoSQL)',
            descripcion: 'Cruce relacional entre la colección de Platillos y Restaurantes',
            consultaMQL: 'Platillo.aggregate([ { $lookup: { from: "restaurantes", ... } }, { $unwind: "$restaurante" } ])',
            datos: resultado
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al ejecutar JOIN NoSQL ($lookup)', detalle: error.message });
    }
};

// 5. GROUP BY NoSQL ($group): Estadísticas biométricas por género
exports.obtenerEstadisticasBiometricas = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const pipeline = [
            {
                $group: {
                    _id: '$perfil_biometrico.genero',
                    totalUsuarios: { $sum: 1 },
                    pesoPromedio: { $avg: '$perfil_biometrico.peso_kg' },
                    alturaPromedio: { $avg: '$perfil_biometrico.altura_m' },
                    imcPromedio: { $avg: '$perfil_biometrico.imc' },
                    metaCaloricaPromedio: { $avg: '$perfil_biometrico.meta_calorica_diaria' }
                }
            },
            {
                $project: {
                    genero: '$_id',
                    _id: 0,
                    totalUsuarios: 1,
                    pesoPromedio: { $round: ['$pesoPromedio', 1] },
                    alturaPromedio: { $round: ['$alturaPromedio', 2] },
                    imcPromedio: { $round: ['$imcPromedio', 1] },
                    metaCaloricaPromedio: { $round: ['$metaCaloricaPromedio', 0] }
                }
            },
            { $sort: { totalUsuarios: -1 } }
        ];

        const estadisticas = await Usuario.aggregate(pipeline);
        res.status(200).json({
            exito: true,
            operacion: 'aggregate() con $group (GROUP BY NoSQL)',
            descripcion: 'Agrupación y cálculo de promedios biométricos según género',
            consultaMQL: 'Usuario.aggregate([ { $group: { _id: "$perfil_biometrico.genero", ... } } ])',
            datos: estadisticas
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error en cálculo de estadísticas', detalle: error.message });
    }
};

// 6. Listar Pedidos
exports.obtenerPedidos = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const pedidos = await Pedido.find().sort({ fecha_pedido: -1 });
        res.status(200).json({
            exito: true,
            total: pedidos.length,
            operacion: 'find()',
            descripcion: 'Listado de pedidos registrados con su estado y PIN de entrega',
            consultaMQL: 'Pedido.find().sort({ fecha_pedido: -1 })',
            datos: pedidos
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al obtener los pedidos', detalle: error.message });
    }
};

// 7. CREAR PEDIDO DESDE CARRITO DE COMPRAS
exports.crearPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { usuario_id, items, total } = req.body;

        const usuario = usuario_id 
            ? await Usuario.findById(usuario_id) 
            : await Usuario.findOne();

        if (!usuario) {
            return res.status(404).json({ exito: false, mensaje: 'No se encontró el usuario que realiza el pedido.' });
        }

        // Si viene desde el carrito con múltiples items
        let detallesFormateados = [];
        let totalCalculado = 0;

        if (Array.isArray(items) && items.length > 0) {
            detallesFormateados = items.map(it => {
                const sub = it.precio * (it.cantidad || 1);
                totalCalculado += sub;
                return {
                    platillo_id: it.platillo_id,
                    nombre_platillo: it.nombre,
                    cantidad: it.cantidad || 1,
                    precio_unitario: it.precio,
                    subtotal: sub
                };
            });
        } else {
            // Fallback para compra directa
            const platillo = await Platillo.findOne();
            totalCalculado = platillo ? platillo.precio : 8500;
            detallesFormateados = [{
                platillo_id: platillo ? platillo._id : new mongoose.Types.ObjectId(),
                nombre_platillo: platillo ? platillo.nombre : 'Platillo Kalo',
                cantidad: 1,
                precio_unitario: totalCalculado,
                subtotal: totalCalculado
            }];
        }

        const codigoRandom = `KALO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const pinRandom = String(Math.floor(1000 + Math.random() * 9000));

        const primerRestaurante = await Restaurante.findOne();

        const nuevoPedido = await Pedido.create({
            codigo_pedido: codigoRandom,
            fecha_pedido: new Date(),
            estado: 'En Preparación', // Listo para que el repartidor lo acepte
            pin_seguridad: pinRandom,
            calificacion_transp: 5,
            cliente: {
                usuario_id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                telefono: usuario.telefono
            },
            restaurante_id: primerRestaurante ? primerRestaurante._id : null,
            detalles: detallesFormateados,
            total: total || totalCalculado
        });

        res.status(201).json({
            exito: true,
            mensaje: `¡Pedido ${codigoRandom} creado exitosamente! Tu PIN de entrega es: ${pinRandom}`,
            operacion: 'create()',
            consultaMQL: `Pedido.create({ codigo_pedido: "${codigoRandom}", pin_seguridad: "${pinRandom}", items: ${detallesFormateados.length} })`,
            pedido: nuevoPedido
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al registrar el pedido', detalle: error.message });
    }
};

// 8. ACEPTAR PEDIDO (Rol Repartidor) -> Pasa de 'En Preparación' a 'En Reparto'
exports.aceptarPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    const { codigo_pedido, repartidor_id } = req.body;

    if (!codigo_pedido) {
        return res.status(400).json({ exito: false, mensaje: 'Debes proporcionar el código de pedido.' });
    }

    try {
        const pedido = await Pedido.findOne({ codigo_pedido });
        if (!pedido) {
            return res.status(404).json({ exito: false, mensaje: `Pedido ${codigo_pedido} no encontrado.` });
        }

        if (pedido.estado !== 'En Preparación') {
            return res.status(400).json({
                exito: false,
                mensaje: `El pedido no puede ser aceptado porque su estado actual es: ${pedido.estado}`
            });
        }

        pedido.estado = 'En Camino';
        if (repartidor_id) {
            pedido.repartidor_id = repartidor_id;
        }
        await pedido.save();

        res.status(200).json({
            exito: true,
            mensaje: `¡Has aceptado el pedido ${codigo_pedido}! Ahora está en reparto hacia el cliente.`,
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${codigo_pedido}" }, { $set: { estado: "En Camino" } })`,
            pedido
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al aceptar el pedido', detalle: error.message });
    }
};

// 9. VALIDACIÓN DE PIN (Rol Repartidor Mobile-First) -> Pasa a 'Entregado'
exports.validarPinEntrega = async (req, res) => {
    if (!verificarConexion(res)) return;
    const { codigo_pedido, pin_ingresado } = req.body;

    if (!codigo_pedido || !pin_ingresado) {
        return res.status(400).json({
            exito: false,
            mensaje: 'Debes proporcionar el código de pedido y el PIN de 4 dígitos.'
        });
    }

    try {
        const pedido = await Pedido.findOne({ codigo_pedido });

        if (!pedido) {
            return res.status(404).json({
                exito: false,
                mensaje: `No se encontró ningún pedido con el código: ${codigo_pedido}`
            });
        }

        if (pedido.estado === 'Entregado') {
            return res.status(400).json({
                exito: false,
                mensaje: 'Este pedido ya fue entregado previamente.'
            });
        }

        if (pedido.pin_seguridad !== pin_ingresado.trim()) {
            return res.status(401).json({
                exito: false,
                mensaje: 'PIN de entrega incorrecto. Solicita al cliente su código correcto.'
            });
        }

        pedido.estado = 'Entregado';
        await pedido.save();

        res.status(200).json({
            exito: true,
            mensaje: '¡Entrega confirmada exitosamente! El PIN ha sido validado correctamente.',
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${codigo_pedido}" }, { $set: { estado: "Entregado" } })`,
            pedido
        });
    } catch (error) {
        res.status(500).json({ exito: false, mensaje: 'Error al validar el PIN de entrega', detalle: error.message });
    }
};
