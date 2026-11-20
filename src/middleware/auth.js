/**
 * Autenticación (JWT) y autorización por rol.
 * El login entrega un token firmado con JWT_SECRET; el frontend lo envía en
 *   Authorization: Bearer <token>
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// En desarrollo, si falta JWT_SECRET se genera una clave al azar (los tokens mueren al reiniciar).
const SECRETO = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const EXPIRA = process.env.JWT_EXPIRA || '8h';

function firmarToken(usuario) {
    return jwt.sign({ id: String(usuario.id), rol: usuario.rol, nombre: usuario.nombre }, SECRETO, { expiresIn: EXPIRA });
}

function verificarToken(req, res, next) {
    const cabecera = req.headers.authorization || '';
    const [tipo, token] = cabecera.split(' ');
    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ exito: false, codigo: 'NO_AUTENTICADO', mensaje: 'Debes iniciar sesión para usar esta función.' });
    }
    try {
        req.usuario = jwt.verify(token, SECRETO); // { id, rol, nombre }
        next();
    } catch (e) {
        const vencido = e.name === 'TokenExpiredError';
        res.status(401).json({
            exito: false,
            codigo: vencido ? 'SESION_VENCIDA' : 'TOKEN_INVALIDO',
            mensaje: vencido ? 'Tu sesión venció. Inicia sesión de nuevo.' : 'La sesión no es válida. Inicia sesión de nuevo.'
        });
    }
}

// permitirRoles('cliente', 'restaurante') → 403 si el rol del token no está en la lista
function permitirRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.usuario.rol)) {
            return res.status(403).json({ exito: false, codigo: 'SIN_PERMISO', mensaje: `Esta acción es solo para: ${roles.join(', ')}.` });
        }
        next();
    };
}

module.exports = { firmarToken, verificarToken, permitirRoles, EXPIRA };
