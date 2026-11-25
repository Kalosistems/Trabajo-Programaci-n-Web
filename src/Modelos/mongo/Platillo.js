const mongoose = require('mongoose');

const MacronutrientesSchema = new mongoose.Schema({
    proteinas_g: { type: Number, default: 0 },
    carbohidratos_g: { type: Number, default: 0 },
    grasas_g: { type: Number, default: 0 }
}, { _id: false });

const IngredienteDetalleSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    cantidad_g: { type: Number, default: 0 },          // cantidad exacta (RF-06)
    unidad: { type: String, enum: ['g', 'ml'], default: 'g' },
    metodo_coccion: { type: String, default: 'Sin especificar' }
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
    categoria: {
        type: String,
        enum: ['Desayuno', 'Almuerzo', 'Cena', 'Snack'],
        default: 'Almuerzo'
    },
    imagen_url: {
        type: String,
        default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'
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
    ingredientes: [IngredienteDetalleSchema],
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
        default: 20
    },
    // true si las calorías y macros los calculó Kalo a partir de los ingredientes (RF-08)
    nutricion_calculada: { type: Boolean, default: false },
    restaurante_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurante'
    },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'platillos'
});

// Catálogo: platillos activos ordenados por transparencia (RNF-03)
PlatilloSchema.index({ activo: 1, indice_transparencia: -1, precio: 1 });
PlatilloSchema.index({ restaurante_id: 1, activo: 1 });

module.exports = mongoose.model('Platillo', PlatilloSchema);
