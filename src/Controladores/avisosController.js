/**
 * AVISOS (notificaciones) y SERVICIO NUTRICIONAL.
 */
const Notificacion = require('../Modelos/mongo/Notificacion');
const { error, falla, verificarConexion, esId } = require('../utils/respuestas');
const { calcularNutrientes, listaAlimentos, calcularIndiceTransparencia, METODOS_COCCION } = require('../utils/nutricion');

// GET /api/mongo/notificaciones  (cualquier rol: solo las propias)
exports.misNotificaciones = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const filtro = { destinatario_id: req.usuario.id };
        const [datos, no_leidas] = await Promise.all([
            Notificacion.find(filtro).sort({ createdAt: -1 }).limit(30).lean(),
            Notificacion.countDocuments({ ...filtro, leida: false })
        ]);
        res.status(200).json({ exito: true, total: datos.length, no_leidas, datos });
    } catch (e) {
        falla(res, e, 'Error al obtener los avisos');
    }
};

// PUT /api/mongo/notificaciones/leidas  { ids?: [] }  (sin ids marca todas)
exports.marcarLeidas = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const filtro = { destinatario_id: req.usuario.id, leida: false };
        const ids = req.body?.ids;
        if (Array.isArray(ids)) {
            if (!ids.every(esId)) return error(res, 400, 'ID_INVALIDO', 'Hay un aviso con identificador no válido.');
            filtro._id = { $in: ids };
        }
        const r = await Notificacion.updateMany(filtro, { $set: { leida: true } });
        res.status(200).json({ exito: true, marcadas: r.modifiedCount });
    } catch (e) {
        falla(res, e, 'Error al marcar los avisos');
    }
};

// GET /api/mongo/nutricion/alimentos  (público) · lista para el autocompletado
exports.alimentos = (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(200).json({ exito: true, metodos_coccion: METODOS_COCCION, datos: listaAlimentos() });
};

// POST /api/mongo/nutricion/calcular  { ingredientes: [...], ...datos del platillo }
// RF-08: el restaurante envía la receta y recibe calorías y macros calculados, y el índice que tendría.
exports.calcular = (req, res) => {
    const { ingredientes } = req.body || {};
    if (!Array.isArray(ingredientes) || !ingredientes.length) {
        return error(res, 400, 'DATOS_FALTANTES', 'Agrega al menos un ingrediente con su cantidad.');
    }
    if (ingredientes.length > 30) return error(res, 422, 'DEMASIADOS_INGREDIENTES', 'Máximo 30 ingredientes.');
    const n = calcularNutrientes(ingredientes);
    if (!n.reconocidos.length) {
        return error(res, 422, 'SIN_DATOS_NUTRICIONALES', 'No reconocimos ningún ingrediente. Revisa los nombres o ingresa las calorías a mano.');
    }
    const datos = { ...req.body, calorias: n.calorias, proteinas: n.proteinas, carbos: n.carbos, grasas: n.grasas };
    const { indice, detalle } = calcularIndiceTransparencia(datos);
    res.status(200).json({
        exito: true,
        mensaje: n.no_reconocidos.length
            ? `Calculado con ${n.reconocidos.length} ingrediente(s). No reconocimos: ${n.no_reconocidos.join(', ')}.`
            : `Calculado con los ${n.reconocidos.length} ingredientes.`,
        fuente: 'Tabla de referencia Kalo (valores por 100 g basados en USDA FoodData Central)',
        datos: { ...n, indice_transparencia: indice, detalle_indice: detalle }
    });
};
