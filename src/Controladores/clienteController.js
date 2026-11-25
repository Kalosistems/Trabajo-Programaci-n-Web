/**
 * CLIENTE: consumo calórico del día (RF-03) y planes nutricionales (RF-21).
 */
const crypto = require('crypto');
const Usuario = require('../Modelos/mongo/Usuario');
const PlanNutricional = require('../Modelos/mongo/PlanNutricional');
const Pedido = require('../Modelos/mongo/Pedido');
const Platillo = require('../Modelos/mongo/Platillo');
const { error, falla, verificarConexion, esId } = require('../utils/respuestas');
const { armarPerfil } = require('../utils/perfil');
const { revisarPago } = require('../utils/pago');
const { avisar } = require('../utils/avisos');
const { datosPublicos } = require('./authController');

// Medianoche de hoy en Chile, sin importar la zona horaria del servidor (Railway usa UTC)
function inicioDelDiaChile(ahora = new Date()) {
    const enChile = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
    const diferencia = ahora.getTime() - enChile.getTime();
    enChile.setHours(0, 0, 0, 0);
    return new Date(enChile.getTime() + diferencia);
}

// GET /api/mongo/usuarios/consumo
// RF-03: calorías consumidas hoy (pedidos entregados hoy) frente a la meta diaria.
// Se actualiza apenas el repartidor confirma la entrega con el PIN.
exports.consumoDelDia = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) return error(res, 404, 'USUARIO_NO_ENCONTRADO', 'No encontramos tu cuenta.');
        const desde = inicioDelDiaChile();

        const pedidos = await Pedido.find({
            'cliente.usuario_id': usuario._id,
            tipo: { $ne: 'plan' },
            $or: [
                { estado: 'Entregado', entregado_en: { $gte: desde } },
                { estado: { $in: ['Pagado', 'En Preparación', 'En Camino'] }, fecha_pedido: { $gte: desde } }
            ]
        }).lean();

        // Pedidos antiguos sin calorías guardadas: se buscan en el platillo
        const sinDato = [...new Set(pedidos.flatMap(p => p.detalles.filter(d => !d.calorias).map(d => String(d.platillo_id))))];
        const kcalPlatillo = new Map((await Platillo.find({ _id: { $in: sinDato } }, 'calorias').lean()).map(p => [String(p._id), p.calorias]));
        const kcalDe = (p) => p.detalles.reduce((s, d) => s + (d.calorias || kcalPlatillo.get(String(d.platillo_id)) || 0) * d.cantidad, 0);

        const entregados = pedidos.filter(p => p.estado === 'Entregado');
        const consumidas = entregados.reduce((s, p) => s + kcalDe(p), 0);
        const enCurso = pedidos.filter(p => p.estado !== 'Entregado').reduce((s, p) => s + kcalDe(p), 0);
        const meta = usuario.perfil_biometrico?.meta_calorica_diaria || 2000;

        res.status(200).json({
            exito: true,
            datos: {
                fecha: desde,
                meta_calorica_diaria: meta,
                consumidas_hoy: Math.round(consumidas),
                en_camino_kcal: Math.round(enCurso),
                restantes: Math.max(0, Math.round(meta - consumidas)),
                porcentaje: Math.round((consumidas / meta) * 100),
                pedidos_entregados_hoy: entregados.length
            }
        });
    } catch (e) {
        falla(res, e, 'Error al calcular el consumo del día');
    }
};

// POST /api/mongo/planes/contratar  { plan_id, pago }   (RF-21)
// Crea un pedido de tipo "plan" (relación "Corresponde a" PLAN_NUTRICIONAL–PEDIDO del modelo E-R)
// con la copia del plan (snapshot) y deja el plan activo en la cuenta: su meta pasa a ser la del plan.
exports.contratarPlan = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { plan_id, pago } = req.body || {};
        if (!esId(plan_id)) return error(res, 400, 'ID_INVALIDO', 'Elige un plan válido.');
        const plan = await PlanNutricional.findOne({ _id: plan_id, activo: true });
        if (!plan) return error(res, 404, 'PLAN_NO_ENCONTRADO', 'Ese plan ya no está disponible.');

        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) return error(res, 404, 'USUARIO_NO_ENCONTRADO', 'No encontramos tu cuenta.');
        if (String(usuario.plan_activo?.plan_id) === String(plan._id)) {
            return error(res, 409, 'PLAN_YA_CONTRATADO', `Ya tienes el plan ${plan.nombre_plan}.`);
        }

        const revision = revisarPago(pago, req.body);
        if (revision.error) return error(res, ...revision.error);

        const codigo = `KALO-${new Date().getFullYear()}-P${crypto.randomInt(10000, 100000)}`;
        const pedido = await Pedido.create({
            codigo_pedido: codigo,
            tipo: 'plan',
            estado: 'Pagado',
            pago: revision.pago,
            cliente: { usuario_id: usuario._id, nombre: usuario.nombre, correo: usuario.correo, telefono: usuario.telefono },
            plan_adquirido: {
                plan_id: plan._id, nombre_plan: plan.nombre_plan,
                calorias_diarias: plan.calorias_diarias, precio_historico: plan.precio_mensual
            },
            detalles: [],
            total: plan.precio_mensual
        });

        usuario.plan_activo = {
            plan_id: plan._id, nombre_plan: plan.nombre_plan, calorias_diarias: plan.calorias_diarias,
            precio_mensual: plan.precio_mensual, codigo_pedido: codigo, desde: new Date()
        };
        usuario.perfil_biometrico.meta_calorica_diaria = plan.calorias_diarias;
        await usuario.save();
        await avisar(usuario._id, 'cliente', 'plan_contratado', 'Plan contratado', `Desde hoy tu meta diaria es de ${plan.calorias_diarias.toLocaleString('es-CL')} kcal (${plan.nombre_plan}).`, codigo);

        res.status(201).json({
            exito: true,
            mensaje: `¡Contrataste el plan ${plan.nombre_plan}! Tu meta diaria ahora es ${plan.calorias_diarias.toLocaleString('es-CL')} kcal.`,
            operacion: 'create() del pedido con snapshot del plan + updateOne() del usuario',
            consultaMQL: `Pedido.create({ tipo: "plan", plan_adquirido: { plan_id, nombre_plan: "${plan.nombre_plan}", precio_historico: ${plan.precio_mensual} } })`,
            pedido,
            usuario: datosPublicos(usuario, 'cliente')
        });
    } catch (e) {
        falla(res, e, 'Error al contratar el plan');
    }
};

// DELETE /api/mongo/planes/contrato   (RF-21: retirar el plan) → la meta vuelve a la recomendada
exports.cancelarPlan = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) return error(res, 404, 'USUARIO_NO_ENCONTRADO', 'No encontramos tu cuenta.');
        if (!usuario.plan_activo) return error(res, 409, 'SIN_PLAN', 'No tienes un plan activo.');
        const nombrePlan = usuario.plan_activo.nombre_plan;

        const { perfil, error: problema } = armarPerfil({}, usuario.perfil_biometrico.toObject());
        if (!problema) usuario.perfil_biometrico.meta_calorica_diaria = perfil.meta_calorica_diaria;
        usuario.plan_activo = null;
        await usuario.save();

        res.status(200).json({
            exito: true,
            mensaje: `Cancelaste el plan ${nombrePlan}. Tu meta vuelve a ser la recomendada para tu perfil.`,
            usuario: datosPublicos(usuario, 'cliente')
        });
    } catch (e) {
        falla(res, e, 'Error al cancelar el plan');
    }
};

exports.inicioDelDiaChile = inicioDelDiaChile;
