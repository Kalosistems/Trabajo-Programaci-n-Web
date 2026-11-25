/**
 * Crea avisos (colección notificaciones). Si falla, no detiene la acción principal:
 * un pedido se crea aunque el aviso no se pueda guardar.
 */
const Notificacion = require('../Modelos/mongo/Notificacion');

async function avisar(destinatario_id, rol, tipo, titulo, mensaje, codigo_pedido = null) {
    if (!destinatario_id) return;
    try {
        await Notificacion.create({ destinatario_id, rol, tipo, titulo, mensaje, codigo_pedido });
    } catch (e) {
        console.error('No se pudo guardar el aviso:', e.message);
    }
}

const numero = (codigo) => `#${String(codigo).split('-').pop()}`;

module.exports = { avisar, numero };
