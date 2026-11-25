/**
 * Pago (RNF-07). El navegador envía los datos de la tarjeta directamente a la pasarela de pago
 * (en esta entrega, una pasarela en modo de prueba: frontend/src/api/pasarela.js) y la pasarela
 * devuelve una referencia. Al servidor de Kalo solo llega esa referencia, la marca y los últimos
 * 4 dígitos. Si alguna solicitud trae algo que parece un número de tarjeta, se rechaza (422).
 */
const REFERENCIA = /^pay_sim_[a-z0-9]{16,40}$/;
const METODOS = ['credito', 'debito'];

// Busca secuencias de 13 a 19 dígitos (con o sin espacios/guiones) en cualquier campo
function contieneNumeroTarjeta(valor) {
    const texto = JSON.stringify(valor ?? '');
    return /(?:\d[ -]?){13,19}/.test(texto.replace(/"(referencia|codigo_pedido|plan_id|platillo_id|_id)":"[^"]*"/g, ''));
}

// Devuelve { pago } si es válido o { error: [http, codigo, mensaje] }
function revisarPago(pago, cuerpoCompleto) {
    if (contieneNumeroTarjeta(cuerpoCompleto)) {
        return { error: [422, 'DATOS_TARJETA_NO_PERMITIDOS', 'Kalo no recibe números de tarjeta: el pago se hace en la pasarela.'] };
    }
    if (!pago || !REFERENCIA.test(String(pago.referencia || ''))) {
        return { error: [402, 'PAGO_REQUERIDO', 'Falta la confirmación de pago de la pasarela.'] };
    }
    const ultimos4 = String(pago.ultimos4 || '');
    if (!/^\d{4}$/.test(ultimos4)) {
        return { error: [422, 'PAGO_INVALIDO', 'La confirmación de pago no es válida.'] };
    }
    return {
        pago: {
            metodo: METODOS.includes(pago.metodo) ? pago.metodo : 'credito',
            marca: String(pago.marca || 'Tarjeta').slice(0, 20),
            ultimos4,
            referencia: String(pago.referencia),
            estado: 'Aprobado',
            fecha: new Date()
        }
    };
}

module.exports = { revisarPago, contieneNumeroTarjeta };
