const mongoose = require('mongoose');

const MacronutrientesSchema = new mongoose.Schema({
    proteinas_g: { type: Number, required: true },
    carbohidratos_g: { type: Number, required: true },
    grasas_g: { type: Number, required: true }
}, { _id: false });

const PlatilloSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del platillo es obligatorio'],
        trim: true
    },
    descripcion: {
        type: String,
        required: true
    },
    precio: {
        type: Number,
        required: [true, 'El precio es obligatorio'],
        min: 0
    },
    calorias: {
        type: Number,
        required: [true, 'Las calorías son obligatorias para la transparencia nutricional']
    },
    macronutrientes: {
        type: MacronutrientesSchema,
        required: true
    },
    indice_transparencia: {
        type: Number,
        min: 1,
        max: 100,
        default: 95
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

