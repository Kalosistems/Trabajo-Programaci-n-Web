/**
 * Respuestas de error uniformes: { exito: false, codigo, mensaje }.
 */
function rutaNoEncontrada(req, res) {
    res.status(404).json({ exito: false, codigo: 'RUTA_NO_ENCONTRADA', mensaje: `No existe la ruta ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ exito: false, codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la solicitud no es un JSON válido.' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ exito: false, codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'La solicitud supera el máximo de 100 KB.' });
    }
    console.error('Error no controlado:', err);
    res.status(500).json({ exito: false, codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado en el servidor.' });
}

module.exports = { rutaNoEncontrada, manejarErrores };
