const mongoose = require('mongoose');

// Avisos para cada cuenta (RF-12, RF-20, RF-23):
// - restaurante: "nuevo pedido pagado", "recibiste una evaluación"
// - cliente: "tu pedido salió del local", "tu repartidor está a 5 minutos", "evalúa tu pedido"
// - repartidor: "se te asignó un pedido"
// Nunca llevan el PIN ni datos de salud (RF-23).
const NotificacionSchema = new mongoose.Schema({
    destinatario_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    rol: { type: String, enum: ['cliente', 'restaurante', 'repartidor'], required: true },
    tipo: {
        type: String,
        enum: ['nuevo_pedido', 'pedido_aceptado', 'pedido_cancelado', 'pedido_en_camino', 'repartidor_cerca',
            'pedido_entregado', 'evaluar', 'nueva_evaluacion', 'pedido_asignado', 'plan_contratado', 'pin_bloqueado'],
        required: true
    },
    titulo: { type: String, required: true, maxlength: 80 },
    mensaje: { type: String, required: true, maxlength: 240 },
    codigo_pedido: { type: String, default: null },
    leida: { type: Boolean, default: false }
}, { timestamps: true, collection: 'notificaciones' });

NotificacionSchema.index({ destinatario_id: 1, createdAt: -1 });
// Los avisos se borran solos a los 30 días (índice TTL)
NotificacionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Notificacion', NotificacionSchema);
