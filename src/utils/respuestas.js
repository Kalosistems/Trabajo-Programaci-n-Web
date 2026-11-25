/**
 * Ayudas compartidas por los controladores: formato de error uniforme
 * { exito: false, codigo, mensaje }, conexión a la base y validación de identificadores.
 */
const mongoose = require('mongoose');

function error(res, http, codigo, mensaje) {
    return res.status(http).json({ exito: false, codigo, mensaje });
}

function falla(res, e, mensaje) {
    console.error(mensaje, e);
    if (e.name === 'ValidationError') {
        return error(res, 422, 'DATOS_INVALIDOS', Object.values(e.errors).map(x => x.message).join(' '));
    }
    if (e.name === 'CastError') return error(res, 400, 'ID_INVALIDO', 'El identificador enviado no es válido.');
    return error(res, 500, 'ERROR_INTERNO', mensaje);
}

function verificarConexion(res) {
    if (mongoose.connection.readyState !== 1) {
        error(res, 503, 'BD_NO_DISPONIBLE', 'La base de datos no está disponible en este momento. Intenta de nuevo en unos minutos.');
        return false;
    }
    return true;
}

const esId = (id) => mongoose.Types.ObjectId.isValid(String(id)) && /^[a-f0-9]{24}$/i.test(String(id));

// Foto subida desde el equipo (data URL JPEG/PNG/WebP en base64) o enlace https.
// Devuelve null si es válida o [http, codigo, mensaje] si no.
function revisarImagen(img, maxCaracteres = 700000) {
    const t = String(img);
    const esArchivo = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(t);
    const esEnlace = /^https?:\/\/\S+$/.test(t) && t.length <= 2000;
    if (!esArchivo && !esEnlace) return [422, 'IMAGEN_INVALIDA', 'La foto debe ser una imagen JPG, PNG o WebP.'];
    if (esArchivo && t.length > maxCaracteres) return [413, 'IMAGEN_MUY_GRANDE', 'La foto es demasiado grande (máximo 500 KB después de comprimirla).'];
    return null;
}

module.exports = { error, falla, verificarConexion, esId, revisarImagen };
