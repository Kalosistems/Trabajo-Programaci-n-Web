/**
 * CONTROLADOR MONGODB (ETAPA 2 - NoSQL KALO)
 * Asignatura: ICI324 Desarrollo Web y Bases de Datos
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

// ALGORITMO DE CÁLCULO DE TRANSPARENCIA KALO (50% base + opcionales hasta 100%)
function calcularIndiceTransparencia(datos) {
    let porcentaje = 50; // Base por nombre, precio y calorías

    if (datos.proteinas && parseFloat(datos.proteinas) > 0) porcentaje += 10;
    if (datos.carbos && parseFloat(datos.carbos) > 0) porcentaje += 10;
    if (datos.grasas && parseFloat(datos.grasas) > 0) porcentaje += 10;
    if (datos.peso_porcion && parseFloat(datos.peso_porcion) > 0) porcentaje += 10;
    if (datos.alergenos && datos.alergenos.trim().length > 3) porcentaje += 5;
    if (datos.ingredientes_limpios === true || datos.ingredientes_limpios === 'true') porcentaje += 5;

    return Math.min(porcentaje, 100);
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

// 3. CREAR NUEVO PLATILLO CON CÁLCULO DINÁMICO DE TRANSPARENCIA (Restaurante)
exports.crearPlatillo = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { 
            nombre, descripcion, precio, calorias, 
            proteinas, carbos, grasas, 
            peso_porcion, alergenos, ingredientes_limpios,
            restaurante_id 
        } = req.body;

        if (!nombre || !precio || !calorias) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El nombre, precio y calorías estimadas son obligatorios.'
            });
        }

        let idRest = restaurante_id;
        if (!idRest) {
            const primerRest = await Restaurante.findOne();
            idRest = primerRest ? primerRest._id : null;
        }

        // Cálculo dinámico del porcentaje de transparencia
        const indiceCalculado = calcularIndiceTransparencia({
            proteinas, carbos, grasas, peso_porcion, alergenos, ingredientes_limpios
        });

        const nuevoPlatillo = await Platillo.create({
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() : 'Plato nutritivo Kalo',
            precio: parseFloat(precio),
            calorias: parseInt(calorias),
            macronutrientes: {
                proteinas_g: parseFloat(proteinas) || 0,
                carbohidratos_g: parseFloat(carbos) || 0,
                grasas_g: parseFloat(grasas) || 0
            },
            peso_porcion_g: peso_porcion ? parseFloat(peso_porcion) : null,
            alergenos: alergenos ? alergenos.trim() : 'No declarados',
            ingredientes_limpios: Boolean(ingredientes_limpios),
            indice_transparencia: indiceCalculado,
            restaurante_id: idRest
        });

        res.status(201).json({
            exito: true,
            mensaje: `¡Platillo registrado! Tu Índice de Transparencia obtenido es del ${indiceCalculado}%.`,
            operacion: 'create()',
            consultaMQL: `Platillo.create({ nombre: "${nombre}", indice_transparencia: ${indiceCalculado}, ... })`,
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
                    peso_porcion_g: 1,
                    alergenos: 1,
                    ingredientes_limpios: 1,
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

// 7. Crear Pedido desde Carrito
exports.crearPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { usuario_id, items, total } = req.body;

        let usuario = null;
        if (usuario_id && mongoose.Types.ObjectId.isValid(usuario_id)) {
            usuario = await Usuario.findById(usuario_id);
        }
        if (!usuario) {
            usuario = await Usuario.findOne();
        }

        if (!usuario) {
            return res.status(404).json({ exito: false, mensaje: 'No se encontró el usuario que realiza el pedido.' });
        }

        let detallesFormateados = [];
        let totalCalculado = 0;

        if (Array.isArray(items) && items.length > 0) {
            detallesFormateados = items.map(it => {
                const sub = (parseFloat(it.precio) || 0) * (parseInt(it.cantidad) || 1);
                totalCalculado += sub;
                
                let idPlato = it.platillo_id;
                if (!idPlato || !mongoose.Types.ObjectId.isValid(idPlato)) {
                    idPlato = new mongoose.Types.ObjectId();
                }

                return {
                    platillo_id: idPlato,
                    nombre_platillo: it.nombre || 'Platillo Kalo',
                    cantidad: parseInt(it.cantidad) || 1,
                    precio_unitario: parseFloat(it.precio) || 0,
                    subtotal: sub
                };
            });
        }

        const codigoRandom = `KALO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const pinRandom = String(Math.floor(1000 + Math.random() * 9000));
        const primerRestaurante = await Restaurante.findOne();

        const nuevoPedido = await Pedido.create({
            codigo_pedido: codigoRandom,
            fecha_pedido: new Date(),
            estado: 'En Preparación',
            pin_seguridad: pinRandom,
            calificacion_transp: 5,
            cliente: {
                usuario_id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                telefono: usuario.telefono || '+56912345678'
            },
            restaurante_id: primerRestaurante ? primerRestaurante._id : null,
            detalles: detallesFormateados,
            total: total || totalCalculado || 5000
        });

        res.status(201).json({
            exito: true,
            mensaje: `¡Pedido ${codigoRandom} creado exitosamente! Tu PIN de entrega es: ${pinRandom}`,
            operacion: 'create()',
            consultaMQL: `Pedido.create({ codigo_pedido: "${codigoRandom}", pin_seguridad: "${pinRandom}" })`,
            pedido: nuevoPedido
        });
    } catch (error) {
        console.error('Error al crear pedido:', error);
        res.status(500).json({ 
            exito: false, 
            mensaje: 'Error al registrar el pedido en Atlas: ' + error.message, 
            detalle: error.message 
        });
    }
};

// 8. Aceptar Pedido (Repartidor)
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

        pedido.estado = 'En Camino';
        if (repartidor_id) pedido.repartidor_id = repartidor_id;
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

// 9. Validar PIN (Repartidor Mobile-First)
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
            return res.status(404).json({ exito: false, mensaje: `Pedido no encontrado: ${codigo_pedido}` });
        }

        if (pedido.estado === 'Entregado') {
            return res.status(400).json({ exito: false, mensaje: 'Este pedido ya fue entregado previamente.' });
        }

        if (pedido.pin_seguridad !== pin_ingresado.trim()) {
            return res.status(401).json({ exito: false, mensaje: 'PIN de entrega incorrecto.' });
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
        res.status(500).json({ exito: false, mensaje: 'Error al validar el PIN', detalle: error.message });
    }
};
