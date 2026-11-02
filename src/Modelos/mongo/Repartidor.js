const mongoose = require('mongoose');

const RepartidorSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre del repartidor es obligatorio'],
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
    telefono: {
        type: String,
        required: [true, 'El teléfono de contacto es obligatorio']
    },
    vehiculo: {
        type: String,
        enum: ['Bicicleta', 'Motocicleta', 'Automóvil'],
        default: 'Motocicleta'
    },
    estado: {
        type: String,
        enum: ['Disponible', 'En Reparto', 'Desconectado'],
        default: 'Disponible'
    },
    calificacion: {
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
    collection: 'repartidores'
});

module.exports = mongoose.model('Repartidor', RepartidorSchema);

