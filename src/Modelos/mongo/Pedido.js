const mongoose = require('mongoose');

// Subdocumento para Referencia Extendida de Cliente
const ClienteRefSchema = new mongoose.Schema({
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    nombre: { type: String, required: true },
    correo: { type: String, required: true },
    telefono: { type: String, default: '+56912345678' }
}, { _id: false });

// Subdocumento para Detalle de Platillos (Detalle_Pedido embebido)
const DetallePlatilloSchema = new mongoose.Schema({
    platillo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Platillo', required: true },
    nombre_platillo: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    precio_unitario: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    calorias: { type: Number, default: 0 } // kcal por unidad al momento de la compra (RF-03)
}, { _id: false });

// Pago (RNF-07): el pago lo procesa una pasarela externa. Kalo solo guarda la referencia
// que devuelve la pasarela, la marca y los últimos 4 dígitos; NUNCA el número de la tarjeta.
const PagoSchema = new mongoose.Schema({
    metodo: { type: String, enum: ['credito', 'debito'], default: 'credito' },
    marca: { type: String, default: 'Tarjeta' },
    ultimos4: { type: String, match: /^\d{4}$/ },
    referencia: { type: String, required: true },
    estado: { type: String, enum: ['Aprobado', 'Reembolsado'], default: 'Aprobado' },
    fecha: { type: Date, default: Date.now }
}, { _id: false });

// Subdocumento para Snapshot Histórico de Plan Nutricional
const PlanSnapshotSchema = new mongoose.Schema({
    plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanNutricional' },
    nombre_plan: { type: String },
    calorias_diarias: { type: Number },
    precio_historico: { type: Number }
}, { _id: false });

const PedidoSchema = new mongoose.Schema({
    codigo_pedido: { 
        type: String, 
        required: true, 
        unique: true 
    },
    fecha_pedido: { 
        type: Date, 
        default: Date.now 
    },
    estado: { 
        type: String, 
        enum: ['Pendiente', 'Pagado', 'En Preparación', 'En Camino', 'Entregado', 'Cancelado'],
        default: 'Pagado'
    },
    // "platillos": pedido de comida · "plan": contratación de un plan nutricional (RF-21)
    tipo: { type: String, enum: ['platillos', 'plan'], default: 'platillos' },
    pago: { type: PagoSchema, default: null },
    total_calorias: { type: Number, default: 0 },
    despachado_en: { type: Date, default: null },
    aviso_cercano_en: { type: Date, default: null }, // RF-23: el repartidor avisó que está a ≤ 5 min
    entregado_en: { type: Date, default: null },
    // PIN de entrega (RF-15): se genera cuando el restaurante despacha el pedido,
    // no al pagar. Solo lo ve el cliente dueño del pedido.
    pin_seguridad: { 
        type: String, 
        minlength: 4, 
        maxlength: 4,
        default: null
    },
    pin_generado_en: { type: Date, default: null },
    intentos_pin: { type: Number, default: 0 }, // a los 5 intentos fallidos se bloquea (423)
    calificacion_transp: { 
        type: Number, 
        min: 1, 
        max: 5, 
        default: null
    },
    evaluacion: {
        similitud_foto: { type: Number, min: 1, max: 5 },
        gramaje_porcion: { type: Number, min: 1, max: 5 },
        velocidad_prep: { type: Number, min: 1, max: 5 },
        calificacion_general: { type: Number, min: 1, max: 5 },
        comentario: { type: String, default: '' },
        fecha_evaluacion: { type: Date }
    },
    cliente: { 
        type: ClienteRefSchema, 
        required: true 
    },
    restaurante_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurante'
    },
    repartidor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repartidor'
    },
    detalles: [DetallePlatilloSchema], // Representa Detalle_Pedido en NoSQL
    plan_adquirido: PlanSnapshotSchema,
    total: { 
        type: Number, 
        required: true, 
        min: 0 
    }
}, { 
    timestamps: true,
    collection: 'pedidos'
});

// Índices para las consultas más frecuentes (cambio hipotético "aparece una consulta
// frecuente nueva"): "mis pedidos" del cliente y "pedidos entrantes" del local por estado.
PedidoSchema.index({ 'cliente.usuario_id': 1, fecha_pedido: -1 });
PedidoSchema.index({ restaurante_id: 1, estado: 1 });
PedidoSchema.index({ repartidor_id: 1, estado: 1 });

module.exports = mongoose.model('Pedido', PedidoSchema);
