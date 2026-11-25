const mongoose = require('mongoose');

// Galería pública de la cocina de cada local (RF-07 · Transparencia de instalaciones).
// Va en su propia colección (cambio hipotético "un restaurante quiere subir muchas fotos" del
// informe): así el documento del restaurante no crece con cada imagen.
// La foto llega comprimida desde el navegador (máx. 1.200 px, JPEG) según RNF-05.
const FotoCocinaSchema = new mongoose.Schema({
    restaurante_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurante', required: true },
    imagen: { type: String, required: true },          // data URL JPEG/PNG/WebP o enlace https
    descripcion: { type: String, trim: true, maxlength: 120, default: '' },
    area: { type: String, enum: ['Cocina', 'Preparación', 'Almacenamiento', 'Lavado', 'Otra'], default: 'Cocina' }
}, { timestamps: true, collection: 'fotos_cocina' });

FotoCocinaSchema.index({ restaurante_id: 1, createdAt: -1 });

module.exports = mongoose.model('FotoCocina', FotoCocinaSchema);
