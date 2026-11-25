/**
 * RESTAURANTES: ranking por transparencia (RF-11), perfil público con galería de la cocina (RF-07)
 * y gestión del menú del local.
 */
const Restaurante = require('../Modelos/mongo/Restaurante');
const Platillo = require('../Modelos/mongo/Platillo');
const Pedido = require('../Modelos/mongo/Pedido');
const FotoCocina = require('../Modelos/mongo/FotoCocina');
const { error, falla, verificarConexion, esId, revisarImagen } = require('../utils/respuestas');
const { recalcularIndiceRestaurante } = require('../utils/ranking');
const { datosPublicos } = require('./authController');

const MAX_FOTOS = 12;
const CAMPOS_PUBLICOS = '-password_hash -correo -__v';
const urlFoto = (id) => `/api/mongo/restaurantes/fotos/${id}`;

// GET /api/mongo/restaurantes  (público) · RF-11: ranking de locales por Índice de Transparencia
exports.listarRestaurantes = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const datos = await Restaurante.aggregate([
            { $match: { activo: true } },
            {
                $lookup: {
                    from: 'platillos', let: { id: '$_id' }, as: 'platos',
                    pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$restaurante_id', '$$id'] }, { $eq: ['$activo', true] }] } } }, { $project: { _id: 1 } }]
                }
            },
            { $lookup: { from: 'fotos_cocina', localField: '_id', foreignField: 'restaurante_id', as: 'fotos', pipeline: [{ $project: { _id: 1 } }] } },
            { $addFields: { total_platillos: { $size: '$platos' }, total_fotos_cocina: { $size: '$fotos' } } },
            { $project: { password_hash: 0, correo: 0, platos: 0, fotos: 0, __v: 0 } },
            { $sort: { indice_transparencia: -1, calificacion_promedio: -1, nombre: 1 } }
        ]);
        res.status(200).json({
            exito: true,
            total: datos.length,
            operacion: 'aggregate() con $lookup, $size y $sort',
            descripcion: 'Locales ordenados por Índice de Transparencia (RF-11)',
            consultaMQL: 'Restaurante.aggregate([ { $match: { activo: true } }, { $lookup: { from: "platillos", ... } }, { $sort: { indice_transparencia: -1, calificacion_promedio: -1 } } ])',
            datos
        });
    } catch (e) {
        falla(res, e, 'Error al obtener los restaurantes');
    }
};

// Evaluaciones públicas de un local: solo el primer nombre del cliente
async function evaluacionesDe(restauranteId, limite = 8) {
    const pedidos = await Pedido.find(
        { restaurante_id: restauranteId, 'evaluacion.calificacion_general': { $gte: 1 } },
        { 'cliente.nombre': 1, evaluacion: 1 }
    ).sort({ 'evaluacion.fecha_evaluacion': -1 }).limit(limite).lean();
    return pedidos.map(p => ({ cliente: String(p.cliente?.nombre || 'Cliente').split(' ')[0], ...p.evaluacion }));
}

async function fotosDe(restauranteId) {
    const fotos = await FotoCocina.find({ restaurante_id: restauranteId }, '-imagen').sort({ createdAt: -1 }).lean();
    return fotos.map(f => ({ ...f, url: urlFoto(f._id) }));
}

// GET /api/mongo/restaurantes/:id  (público) · perfil del local con galería de la cocina (RF-07)
exports.perfilRestaurante = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { id } = req.params;
        if (!esId(id)) return error(res, 400, 'ID_INVALIDO', 'El identificador no es válido.');
        const restaurante = await Restaurante.findOne({ _id: id, activo: true }, CAMPOS_PUBLICOS).lean();
        if (!restaurante) return error(res, 404, 'RESTAURANTE_NO_ENCONTRADO', 'Ese local no existe.');
        const [platillos, fotos, evaluaciones] = await Promise.all([
            Platillo.find({ restaurante_id: id, activo: true }).sort({ indice_transparencia: -1 }).lean(),
            fotosDe(id),
            evaluacionesDe(id)
        ]);
        res.status(200).json({ exito: true, datos: { restaurante, platillos, fotos, evaluaciones } });
    } catch (e) {
        falla(res, e, 'Error al obtener el local');
    }
};

// GET /api/mongo/restaurantes/fotos/:id  (público) · entrega la imagen con caché del navegador
exports.imagenFoto = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        if (!esId(req.params.id)) return error(res, 400, 'ID_INVALIDO', 'El identificador no es válido.');
        const foto = await FotoCocina.findById(req.params.id, 'imagen').lean();
        if (!foto) return error(res, 404, 'FOTO_NO_ENCONTRADA', 'La foto ya no existe.');
        if (/^https?:\/\//.test(foto.imagen)) return res.redirect(302, foto.imagen);
        const [, tipo, base64] = foto.imagen.match(/^data:(image\/[a-z]+);base64,(.+)$/) || [];
        if (!tipo) return error(res, 404, 'FOTO_NO_ENCONTRADA', 'La foto no es válida.');
        res.set('Cache-Control', 'public, max-age=86400, immutable');
        res.type(tipo).send(Buffer.from(base64, 'base64'));
    } catch (e) {
        falla(res, e, 'Error al obtener la foto');
    }
};

// GET /api/mongo/restaurantes/mi-local  (restaurante)
exports.verMiLocal = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const rest = await Restaurante.findById(req.usuario.id);
        if (!rest) return error(res, 404, 'RESTAURANTE_NO_ENCONTRADO', 'No encontramos tu local.');
        const [fotos, evaluaciones] = await Promise.all([fotosDe(rest._id), evaluacionesDe(rest._id, 20)]);
        res.status(200).json({ exito: true, datos: { restaurante: datosPublicos(rest, 'restaurante'), fotos, evaluaciones, max_fotos: MAX_FOTOS } });
    } catch (e) {
        falla(res, e, 'Error al obtener tu local');
    }
};

// POST /api/mongo/restaurantes/fotos  { imagen, descripcion, area }  (restaurante · RF-07, RNF-05)
exports.subirFotoCocina = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { imagen, descripcion, area } = req.body || {};
        if (!imagen) return error(res, 400, 'DATOS_FALTANTES', 'Elige una foto de tu cocina.');
        const problema = revisarImagen(imagen);
        if (problema) return error(res, ...problema);
        const total = await FotoCocina.countDocuments({ restaurante_id: req.usuario.id });
        if (total >= MAX_FOTOS) return error(res, 422, 'LIMITE_FOTOS', `Puedes tener hasta ${MAX_FOTOS} fotos. Elimina una para subir otra.`);

        const foto = await FotoCocina.create({
            restaurante_id: req.usuario.id,
            imagen,
            descripcion: descripcion ? String(descripcion).trim().slice(0, 120) : '',
            area: ['Cocina', 'Preparación', 'Almacenamiento', 'Lavado', 'Otra'].includes(area) ? area : 'Cocina'
        });
        // La primera foto queda como Foto_cocina principal del local
        await Restaurante.updateOne({ _id: req.usuario.id, foto_cocina: null }, { $set: { foto_cocina: urlFoto(foto._id) } });
        const { imagen: _omitida, ...resto } = foto.toObject();
        res.status(201).json({ exito: true, mensaje: '¡Foto publicada en tu galería!', foto: { ...resto, url: urlFoto(foto._id) } });
    } catch (e) {
        falla(res, e, 'Error al subir la foto');
    }
};

// DELETE /api/mongo/restaurantes/fotos/:id  (restaurante, solo sus fotos)
exports.eliminarFotoCocina = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        if (!esId(req.params.id)) return error(res, 400, 'ID_INVALIDO', 'El identificador no es válido.');
        const borrada = await FotoCocina.findOneAndDelete({ _id: req.params.id, restaurante_id: req.usuario.id });
        if (!borrada) return error(res, 404, 'FOTO_NO_ENCONTRADA', 'Esa foto no existe en tu galería.');
        const rest = await Restaurante.findById(req.usuario.id, 'foto_cocina');
        if (rest && rest.foto_cocina === urlFoto(borrada._id)) {
            const otra = await FotoCocina.findOne({ restaurante_id: req.usuario.id }, '_id').sort({ createdAt: -1 });
            rest.foto_cocina = otra ? urlFoto(otra._id) : null;
            await rest.save();
        }
        res.status(200).json({ exito: true, mensaje: 'Foto eliminada.' });
    } catch (e) {
        falla(res, e, 'Error al eliminar la foto');
    }
};

// GET /api/mongo/platillos/mios  (restaurante) · incluye los platillos retirados del menú
exports.misPlatillos = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const datos = await Platillo.find({ restaurante_id: req.usuario.id }).sort({ activo: -1, createdAt: -1 }).lean();
        res.status(200).json({ exito: true, total: datos.length, datos });
    } catch (e) {
        falla(res, e, 'Error al obtener tus platillos');
    }
};

// PUT /api/mongo/platillos/:id/estado  { activo }  (restaurante) · publicar o retirar del menú
exports.cambiarEstadoPlatillo = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        if (!esId(req.params.id)) return error(res, 400, 'ID_INVALIDO', 'El identificador no es válido.');
        const activo = req.body?.activo === true || req.body?.activo === 'true';
        const plato = await Platillo.findOneAndUpdate(
            { _id: req.params.id, restaurante_id: req.usuario.id },
            { $set: { activo } }, { new: true }
        );
        if (!plato) return error(res, 404, 'PLATILLO_NO_ENCONTRADO', 'Ese platillo no es de tu local.');
        const ranking = await recalcularIndiceRestaurante(req.usuario.id);
        res.status(200).json({
            exito: true,
            mensaje: activo ? `"${plato.nombre}" volvió al menú.` : `"${plato.nombre}" se retiró del menú.`,
            indice_restaurante: ranking.indice_transparencia,
            platillo: plato
        });
    } catch (e) {
        falla(res, e, 'Error al cambiar el platillo');
    }
};

exports.MAX_FOTOS = MAX_FOTOS;
