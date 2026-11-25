const mongoose = require('mongoose');

const RestauranteSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del restaurante es obligatorio'],
        trim: true
    },
    correo: {
        type: String,
        required: [true, 'El correo de acceso es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true
    },
    password_hash: {
        type: String,
        required: [true, 'La contraseña es obligatoria'],
        select: false // hash bcrypt, no se devuelve en las consultas
    },
    especialidad: {
        type: String,
        required: true,
        trim: true
    },
    direccion: {
        type: String,
        required: true
    },
    telefono: {
        type: String,
        default: '+56900000000'
    },
    calificacion_promedio: {
        type: Number,
        min: 1,
        max: 5,
        default: 5.0
    },
    // Índice de Transparencia del local (RF-11, RF-14): promedio de sus platillos y de las
    // evaluaciones de los clientes. Ordena el catálogo (los más transparentes primero).
    indice_transparencia: { type: Number, min: 0, max: 100, default: 0 },
    total_evaluaciones: { type: Number, default: 0 },
    // Foto_cocina del modelo E-R: foto principal de la cocina. La galería completa está en
    // la colección fotos_cocina (RF-07), para no agrandar este documento.
    foto_cocina: { type: String, default: null },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'restaurantes'
});

RestauranteSchema.index({ activo: 1, indice_transparencia: -1 });

module.exports = mongoose.model('Restaurante', RestauranteSchema);

