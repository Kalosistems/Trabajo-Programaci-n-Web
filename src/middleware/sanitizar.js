/**
 * Protección contra inyección NoSQL (RNF-10).
 * En MongoDB, un cuerpo como { "correo": { "$ne": null } } podría saltarse un filtro.
 * Este middleware rechaza cualquier clave que empiece con "$" o tenga un punto, en el cuerpo
 * y en los parámetros de la URL, antes de que lleguen a los controladores.
 */
function claveProhibida(objeto, profundidad = 0) {
    if (!objeto || typeof objeto !== 'object' || profundidad > 8) return null;
    for (const clave of Object.keys(objeto)) {
        if (clave.startsWith('$') || clave.includes('.')) return clave;
        const dentro = claveProhibida(objeto[clave], profundidad + 1);
        if (dentro) return dentro;
    }
    return null;
}

function sanitizar(req, res, next) {
    const clave = claveProhibida(req.body) || claveProhibida(req.query) || claveProhibida(req.params);
    if (clave) {
        return res.status(400).json({ exito: false, codigo: 'DATOS_NO_PERMITIDOS', mensaje: `El campo "${clave}" no está permitido.` });
    }
    // Los parámetros de la URL deben ser texto simple (no objetos ni listas)
    for (const [k, v] of Object.entries(req.query || {})) {
        if (typeof v !== 'string') {
            return res.status(400).json({ exito: false, codigo: 'PARAMETRO_INVALIDO', mensaje: `El parámetro "${k}" debe ser un valor simple.` });
        }
    }
    next();
}

module.exports = { sanitizar };
