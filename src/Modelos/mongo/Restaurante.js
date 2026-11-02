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
        required: [true, 'La contraseña es obligatoria']
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
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'restaurantes'
});

module.exports = mongoose.model('Restaurante', RestauranteSchema);

