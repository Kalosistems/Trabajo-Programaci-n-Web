const mongoose = require('mongoose');

const MacronutrientesSchema = new mongoose.Schema({
    proteinas_g: { type: Number, default: 0 },
    carbohidratos_g: { type: Number, default: 0 },
    grasas_g: { type: Number, default: 0 }
}, { _id: false });

const PlatilloSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del platillo es obligatorio'],
        trim: true
    },
    descripcion: {
        type: String,
        default: 'Plato nutritivo Kalo'
    },
    precio: {
        type: Number,
        required: [true, 'El precio es obligatorio'],
        min: 0
    },
    calorias: {
        type: Number,
        required: [true, 'Las calorías son obligatorias para el cálculo nutricional']
    },
    // Campos opcionales que elevan el Índice de Transparencia
    macronutrientes: {
        type: MacronutrientesSchema,
        default: () => ({ proteinas_g: 0, carbohidratos_g: 0, grasas_g: 0 })
    },
    peso_porcion_g: {
        type: Number,
        default: null // Gramaje exacto de la porción servida
    },
    alergenos: {
        type: String,
        default: 'No declarados' // ej. "Sin gluten, sin lactosa"
    },
    ingredientes_limpios: {
        type: Boolean,
        default: false // Sello sin ultraprocesados
    },
    indice_transparencia: {
        type: Number,
        min: 1,
        max: 100,
        default: 50
    },
    restaurante_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurante',
        required: true
    },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'platillos'
});

module.exports = mongoose.model('Platillo', PlatilloSchema);
