/**
 * Límites y cuotas de la API (ver sección "Límites y cuotas" del informe y docs/API.md).
 * Se cuentan por dirección IP y responden 429 con el formato de error de Kalo.
 */
const rateLimit = require('express-rate-limit');

function crearLimite(ventanaMin, maximo, mensaje, soloFallidas = false) {
    return rateLimit({
        skipSuccessfulRequests: soloFallidas, // true: solo cuentan las respuestas con error
        windowMs: ventanaMin * 60 * 1000,
        limit: maximo,
        standardHeaders: 'draft-7',   // cabecera RateLimit con límite, restantes y reinicio
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json({ exito: false, codigo: 'DEMASIADAS_SOLICITUDES', mensaje })
    });
}

module.exports = {
    // Toda la API: 300 solicitudes cada 15 minutos por IP
    limiteGeneral: crearLimite(15, 300, 'Demasiadas solicitudes. Espera unos minutos y vuelve a intentarlo.'),
    // Login y registro: 10 intentos FALLIDOS cada 15 minutos por IP (frena el adivinar contraseñas)
    limiteAcceso: crearLimite(15, 10, 'Demasiados intentos fallidos. Espera 15 minutos.', true),
    // Validar PIN: 20 intentos fallidos cada 15 minutos por IP (además, 5 intentos por pedido)
    limitePin: crearLimite(15, 20, 'Demasiados intentos de PIN. Espera 15 minutos.', true)
};
