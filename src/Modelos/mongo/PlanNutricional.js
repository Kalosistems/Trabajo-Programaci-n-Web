const mongoose = require('mongoose');

const PlanNutricionalSchema = new mongoose.Schema({
    nombre_plan: { type: String, required: true, trim: true },
    calorias_diarias: { type: Number, required: true },
    objetivo: { type: String, required: true },
    precio_mensual: { type: Number, required: true },
    activo: { type: Boolean, default: true },
    tags: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('PlanNutricionalMongo', PlanNutricionalSchema, 'planes_nutricionales');

