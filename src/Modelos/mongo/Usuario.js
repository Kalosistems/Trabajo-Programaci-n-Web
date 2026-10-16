const mongoose = require('mongoose');

const PerfilBiometricoSchema = new mongoose.Schema({
    peso_kg: { type: Number, required: true },
    altura_m: { type: Number, required: true },
    edad: { type: Number, required: true },
    genero: { type: String, enum: ['Masculino', 'Femenino', 'Otro'], default: 'Otro' },
    imc: { type: Number },
    meta_calorica_diaria: { type: Number },
    objetivo_salud: { type: String, default: 'Mantenimiento y nutrición balanceada' }
}, { _id: false });

const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    telefono: { type: String, default: '+56912345678' },
    activo: { type: Boolean, default: true },
    fecha_registro: { type: Date, default: Date.now },
    perfil_biometrico: { type: PerfilBiometricoSchema, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Usuario', UsuarioSchema, 'Usuario');

