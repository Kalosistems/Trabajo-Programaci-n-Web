const mongoose = require('mongoose');
const { numeroCifrado, textoCifrado } = require('../../utils/cifrado');

// Perfil biométrico (RF-01). Los datos de salud se guardan CIFRADOS con AES-256-GCM (RNF-02):
// en la base quedan como "enc:v1:..." y Mongoose los descifra al leerlos (getters).
// Los rangos (peso 20-350, altura 1-2,5, edad 12-110) se validan en el controlador.
const PerfilBiometricoSchema = new mongoose.Schema({
    peso_kg: { type: String, required: true, ...numeroCifrado },
    altura_m: { type: String, required: true, ...numeroCifrado },
    edad: { type: String, required: true, ...numeroCifrado },
    genero: { type: String, enum: ['Masculino', 'Femenino', 'Otro'], default: 'Otro' },
    // Nivel de actividad y objetivo: entran en el cálculo de la meta calórica (RF-03)
    nivel_actividad: { type: String, enum: ['sedentario', 'ligero', 'moderado', 'intenso'], default: 'ligero' },
    objetivo: { type: String, ...textoCifrado },           // bajar | mantener | subir
    imc: { type: String, ...numeroCifrado },               // derivado: peso / altura²
    meta_calorica_diaria: { type: String, ...numeroCifrado }, // derivado (o la del plan contratado)
    objetivo_salud: { type: String, ...textoCifrado }
}, { _id: false, id: false, toJSON: { getters: true }, toObject: { getters: true } });

// Plan nutricional contratado (RF-21): copia del plan al momento de contratarlo
const PlanActivoSchema = new mongoose.Schema({
    plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PlanNutricionalMongo' },
    nombre_plan: String,
    calorias_diarias: Number,
    precio_mensual: Number,
    codigo_pedido: String,
    desde: { type: Date, default: Date.now }
}, { _id: false });

const UsuarioSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
    telefono: { type: String, default: '+56912345678' },
    activo: { type: Boolean, default: true },
    fecha_registro: { type: Date, default: Date.now },
    perfil_biometrico: { type: PerfilBiometricoSchema, required: true },
    plan_activo: { type: PlanActivoSchema, default: null }
}, { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } });

// Colección en minúscula y plural, igual que las demás (antes se llamaba "Usuario")
module.exports = mongoose.model('Usuario', UsuarioSchema, 'usuarios');
