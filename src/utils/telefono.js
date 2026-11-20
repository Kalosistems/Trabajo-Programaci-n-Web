/**
 * Teléfono: debe tener exactamente 11 dígitos (ej. +569 1234 5678).
 * Se permite un "+" al inicio y espacios o guiones al escribirlo; se guarda sin espacios ni guiones.
 */
const TELEFONO_VALIDO = /^\+?\d{11}$/;
const MENSAJE_TELEFONO = 'El teléfono está incompleto: debe tener 11 dígitos (ej. +569 1234 5678).';

function normalizarTelefono(valor) {
    return String(valor ?? '').replace(/[\s-]/g, '');
}

function telefonoValido(valor) {
    return TELEFONO_VALIDO.test(normalizarTelefono(valor));
}

module.exports = { normalizarTelefono, telefonoValido, MENSAJE_TELEFONO };
