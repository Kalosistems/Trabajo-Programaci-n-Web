// Pasarela de pago en MODO DE PRUEBA (RNF-07).
// En producción este archivo se reemplaza por el SDK de una pasarela certificada PCI-DSS:
// el número de la tarjeta va del navegador a la pasarela y NUNCA al servidor de Kalo.
// Kalo solo recibe la referencia del pago, la marca y los últimos 4 dígitos.
//
// Tarjetas de prueba:
//   4111 1111 1111 1111 → aprobada        5555 5555 5555 4444 → aprobada (Mastercard)
//   4000 0000 0000 0002 → rechazada (fondos insuficientes)

export const TARJETAS_PRUEBA = [
  { numero: '4111 1111 1111 1111', resultado: 'Aprobada' },
  { numero: '5555 5555 5555 4444', resultado: 'Aprobada' },
  { numero: '4000 0000 0000 0002', resultado: 'Rechazada' }
];

// Algoritmo de Luhn: detecta números de tarjeta mal escritos
export function luhnValido(numero) {
  const d = String(numero).replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
  }
  return suma % 10 === 0;
}

export function marcaDe(numero) {
  const d = String(numero).replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  return 'Tarjeta';
}

export function vencimientoValido(mmaa) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(mmaa || '');
  if (!m) return false;
  const mes = +m[1];
  const anio = 2000 + +m[2];
  if (mes < 1 || mes > 12) return false;
  const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
  return finDeMes >= new Date();
}

const referencia = () => {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return `pay_sim_${Array.from(a, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20)}`;
};

// Simula la autorización de la pasarela (tarda ~1 s). Devuelve solo datos que NO son sensibles.
export function autorizarPago({ numero, titular, vencimiento, cvv, metodo, monto }) {
  return new Promise((resolver, rechazar) => {
    const d = String(numero).replace(/\D/g, '');
    if (!titular?.trim()) return rechazar(new Error('Escribe el nombre del titular.'));
    if (!luhnValido(d)) return rechazar(new Error('El número de la tarjeta no es válido.'));
    if (!vencimientoValido(vencimiento)) return rechazar(new Error('La fecha de vencimiento no es válida o la tarjeta está vencida.'));
    if (!/^\d{3,4}$/.test(cvv || '')) return rechazar(new Error('El código de seguridad (CVV) debe tener 3 o 4 dígitos.'));
    if (!(monto > 0)) return rechazar(new Error('El monto no es válido.'));
    setTimeout(() => {
      if (d === '4000000000000002') return rechazar(new Error('Pago rechazado por el banco: fondos insuficientes.'));
      resolver({ referencia: referencia(), marca: marcaDe(d), ultimos4: d.slice(-4), metodo: metodo === 'debito' ? 'debito' : 'credito' });
    }, 900);
  });
}
