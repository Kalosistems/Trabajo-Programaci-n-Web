/**
 * CONTROLADOR MONGODB (ETAPA 2 - NoSQL)
 * Proyecto: Kalo (NutriDelivery)
 * Asignatura: ICI324 Desarrollo Web y Bases de Datos
 * 
 * Implementa las operaciones clave en MongoDB Atlas demostrando:
 * - Consultas sobre subdocumentos embebidos (perfil biométrico).
 * - Consultas resueltas sin JOINs gracias a Referencia Extendida y Snapshot.
 * - Filtros MQL ($gt, $set) y agregaciones ($group, $avg).
 */

const Usuario = require('../Modelos/mongo/Usuario');
const PlanNutricionalMongo = require('../Modelos/mongo/PlanNutricional');
const PedidoMongo = require('../Modelos/mongo/Pedido');

// 1. SELECT NoSQL: Listar usuarios con perfil biométrico embebido
exports.getUsuarios = async (req, res) => {
    try {
        const mql = 'Usuario.find({}, { password_hash: 0 })';
        const data = await Usuario.find({}, { password_hash: 0 });
        res.json({
            exito: true,
            tipo: 'MongoDB find()',
            descripcion: 'Lectura de usuarios con su perfil_biometrico embebido (1 sola lectura)',
            consultaMQL: mql,
            resultado: data
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 2. FILTRO MQL: Planes con precio > 20 ordenados descendentemente
exports.getPlanes = async (req, res) => {
    try {
        const mql = 'PlanNutricional.find({ precio_mensual: { $gt: 20 }, activo: true }).sort({ precio_mensual: -1 })';
        const data = await PlanNutricionalMongo.find({ precio_mensual: { $gt: 20 }, activo: true }).sort({ precio_mensual: -1 });
        res.json({
            exito: true,
            tipo: 'MongoDB find() con $gt y sort()',
            descripcion: 'Filtrado de planes nutricionales activos con precio > 20 ordenados descendentemente',
            consultaMQL: mql,
            resultado: data
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 3. SIN JOIN: Pedidos detallados mediante Referencia Extendida y Snapshot
exports.getPedidosSinJoin = async (req, res) => {
    try {
        const mql = 'Pedido.find().sort({ fecha_pedido: -1 }) // Resuelto sin $lookup gracias a Referencia Extendida';
        const data = await PedidoMongo.find().sort({ fecha_pedido: -1 });
        res.json({
            exito: true,
            tipo: 'MongoDB find() (Sin JOIN)',
            descripcion: 'Consulta de pedidos completa en 1 lectura gracias al Patrón de Referencia Extendida y Snapshot de Plan',
            consultaMQL: mql,
            beneficioNoSQL: 'Cero operaciones de JOIN; cliente y plan ya vienen desnormalizados de forma controlada',
            resultado: data
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 4. AGGREGATION PIPELINE: Equivalente NoSQL a GROUP BY, COUNT y AVG
exports.getEstadisticasBiometricas = async (req, res) => {
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
            { $sort: { totalUsuarios: -1 } }
        ];
        const mql = 'Usuario.aggregate([' + JSON.stringify(pipeline) + '])';
        const data = await Usuario.aggregate(pipeline);
        res.json({
            exito: true,
            tipo: 'MongoDB Aggregation Pipeline ($group, $avg, $sum)',
            descripcion: 'Agregación estadística agrupada por género calculando promedios biométricos',
            consultaMQL: mql,
            resultado: data
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 5. INSERT NoSQL: Registrar nuevo pedido con PIN de 4 dígitos
exports.crearPedido = async (req, res) => {
    try {
        const usuario = await Usuario.findOne();
        const plan = await PlanNutricionalMongo.findOne();

        if (!usuario || !plan) {
            return res.status(400).json({ exito: false, error: 'Deben existir usuarios y planes para crear un pedido' });
        }

        const nuevoCodigo = `KALO-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
        const pin = String(Math.floor(1000 + Math.random() * 9000));

        const nuevoPedido = await PedidoMongo.create({
            codigo_pedido: nuevoCodigo,
            fecha_pedido: new Date(),
            estado: 'En Preparación',
            pin_seguridad: pin,
            cliente: {
                usuario_id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                telefono: usuario.telefono
            },
            plan_adquirido: {
                plan_id: plan._id,
                nombre_plan: plan.nombre_plan,
                calorias_diarias: plan.calorias_diarias,
                precio_historico: plan.precio_mensual
            },
            total: plan.precio_mensual
        });

        const mql = `Pedido.create({ codigo_pedido: "${nuevoCodigo}", pin_seguridad: "${pin}", cliente: {...}, plan_adquirido: {...} })`;
        res.json({
            exito: true,
            tipo: 'MongoDB create() (INSERT documental)',
            descripcion: 'Nuevo pedido creado con código PIN de 4 dígitos y snapshot inmutable del plan',
            consultaMQL: mql,
            resultado: nuevoPedido
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 6. UPDATE NoSQL: Actualizar peso e IMC atómicamente con $set
exports.actualizarPesoUsuario = async (req, res) => {
    try {
        const { id, nuevoPeso } = req.body;
        const usuario = id ? await Usuario.findById(id) : await Usuario.findOne();

        if (!usuario) {
            return res.status(404).json({ exito: false, error: 'Usuario no encontrado' });
        }

        const peso = Number(nuevoPeso) || 73.5;
        const altura = usuario.perfil_biometrico.altura_m || 1.74;
        const nuevoIMC = Number((peso / (altura ** 2)).toFixed(2));

        const mql = `Usuario.updateOne({ _id: "${usuario._id}" }, { $set: { "perfil_biometrico.peso_kg": ${peso}, "perfil_biometrico.imc": ${nuevoIMC} } })`;

        await Usuario.updateOne(
            { _id: usuario._id },
            { 
                $set: { 
                    'perfil_biometrico.peso_kg': peso,
                    'perfil_biometrico.imc': nuevoIMC
                } 
            }
        );

        const usuarioActualizado = await Usuario.findById(usuario._id);

        res.json({
            exito: true,
            tipo: 'MongoDB updateOne() con $set',
            descripcion: 'Actualización atómica de peso e IMC dentro del subdocumento embebido perfil_biometrico',
            consultaMQL: mql,
            resultado: usuarioActualizado
        });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};
