const mongoose = require('mongoose');

const PerfilBiometricoSchema = new mongoose.Schema({
    peso_kg: { type: Number, required: true, min: 20, max: 350 },
    altura_m: { type: Number, required: true, min: 1.0, max: 2.5 },
    edad: { type: Number, required: true, min: 12, max: 110 },
    genero: { type: String, enum: ['Masculino', 'Femenino', 'Otro'], default: 'Otro' },
    imc: { type: Number },
    meta_calorica_diaria: { type: Number },
    objetivo_salud: { type: String, default: 'Mantenimiento y nutrición balanceada' }
}, { _id: false });

const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Hash bcrypt de la contraseña (nunca la contraseña en texto plano)
    password_hash: { type: String, required: true, select: false },
    telefono: { type: String, default: '+56912345678' },
    activo: { type: Boolean, default: true },
    fecha_registro: { type: Date, default: Date.now },
    perfil_biometrico: { type: PerfilBiometricoSchema, required: true }
}, { timestamps: true });

// Colección en minúscula y plural, igual que las demás (antes se llamaba "Usuario")
module.exports = mongoose.model('Usuario', UsuarioSchema, 'usuarios');
