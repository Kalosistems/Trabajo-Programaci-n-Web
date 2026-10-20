const mongoose = require('mongoose');

// Subdocumento para Referencia Extendida de Cliente (Id_cliente)
const ClienteRefSchema = new mongoose.Schema({
    usuario_id: { type: mongoose.Schema.Types.Mixed, required: true },
    nombre: { type: String, required: true },
    correo: { type: String, required: true },
    telefono: { type: String, default: '+56912345678' }
}, { _id: false });

// Subdocumento para Snapshot Histórico de Plan Nutricional (Id_plan)
const PlanSnapshotSchema = new mongoose.Schema({
    plan_id: { type: mongoose.Schema.Types.Mixed, required: true },
    nombre_plan: { type: String, required: true },
    calorias_diarias: { type: Number, required: true },
    precio_historico: { type: Number, required: true }
}, { _id: false });

const PedidoSchema = new mongoose.Schema({
    codigo_pedido: { type: String, required: true, unique: true },
    fecha_pedido: { type: Date, default: Date.now },
    estado: { 
        type: String, 
        enum: ['Pendiente', 'En Preparación', 'En Camino', 'Entregado', 'Cancelado'],
        default: 'Pendiente'
    },
    pin_seguridad: { type: String, required: true, minlength: 4, maxlength: 4 },
    calificacion_transp: { type: Number, min: 1, max: 5, default: 5 }, // Calificacion_transp.
    cliente: { type: ClienteRefSchema, required: true },
    plan_adquirido: { type: PlanSnapshotSchema, required: true },
    total: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('PedidoMongo', PedidoSchema, 'pedidos');
