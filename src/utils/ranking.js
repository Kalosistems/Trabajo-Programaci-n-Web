/**
 * Índice de Transparencia del restaurante (RF-11 y RF-14).
 * - Sin evaluaciones: promedio del índice de sus platillos activos.
 * - Con evaluaciones: 60 % platillos + 40 % lo que dicen los clientes sobre la transparencia
 *   (similitud con la foto y porción real, de 1 a 5 → 0 a 100).
 * Se recalcula cada vez que el local publica o retira un platillo y cada vez que un cliente evalúa.
 */
const mongoose = require('mongoose');
const Platillo = require('../Modelos/mongo/Platillo');
const Pedido = require('../Modelos/mongo/Pedido');
const Restaurante = require('../Modelos/mongo/Restaurante');

async function recalcularIndiceRestaurante(restauranteId) {
    const id = new mongoose.Types.ObjectId(String(restauranteId));

    const [platos] = await Platillo.aggregate([
        { $match: { restaurante_id: id, activo: true } },
        { $group: { _id: null, promedio: { $avg: '$indice_transparencia' } } }
    ]);
    const [evals] = await Pedido.aggregate([
        { $match: { restaurante_id: id, 'evaluacion.calificacion_general': { $gte: 1 } } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                general: { $avg: '$evaluacion.calificacion_general' },
                foto: { $avg: '$evaluacion.similitud_foto' },
                porcion: { $avg: '$evaluacion.gramaje_porcion' }
            }
        }
    ]);

    const promPlatillos = platos ? platos.promedio : 0;
    let indice = promPlatillos;
    const cambios = {};
    if (evals && evals.total > 0) {
        const opinion = ((evals.foto + evals.porcion) / 2 / 5) * 100;
        indice = promPlatillos ? 0.6 * promPlatillos + 0.4 * opinion : opinion;
        cambios.calificacion_promedio = Math.round(evals.general * 10) / 10;
        cambios.total_evaluaciones = evals.total;
    }
    cambios.indice_transparencia = Math.round(indice);
    await Restaurante.updateOne({ _id: id }, { $set: cambios });
    return cambios;
}

module.exports = { recalcularIndiceRestaurante };
