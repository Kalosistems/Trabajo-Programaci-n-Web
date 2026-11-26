// Cliente HTTP de Kalo: todas las pantallas llaman a la API REST a través de estas funciones.
// La API responde { exito: true, ... } o { exito: false, codigo, mensaje } (ver docs/API.md).
// La sesión va en una cookie httpOnly que pone el servidor: este código NUNCA ve ni guarda el token.

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

const SESION_TERMINADA = ['NO_AUTENTICADO', 'TOKEN_INVALIDO', 'SESION_VENCIDA', 'SESION_CERRADA'];

async function pedir(metodo, ruta, cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: 'same-origin', // el navegador agrega la cookie de sesión por su cuenta
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No pudimos conectar con Kalo. Revisa tu conexión e intenta de nuevo.');
  }

  let json = null;
  try { json = await respuesta.json(); } catch { /* respuesta vacía */ }

  if (!respuesta.ok || !json?.exito) {
    const err = new ErrorApi(respuesta.status, json?.codigo || 'ERROR', json?.mensaje || `El servidor respondió con error ${respuesta.status}.`);
    // Sesión vencida o cerrada: la app vuelve al inicio de sesión
    if (respuesta.status === 401 && SESION_TERMINADA.includes(err.codigo) && ruta !== '/sesion') {
      window.dispatchEvent(new CustomEvent('kalo:sesion-vencida', { detail: err.message }));
    }
    throw err;
  }
  return json;
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  // Autenticación
  login: (correo, password) => pedir('POST', '/login', { correo, password }),
  registro: (datos) => pedir('POST', '/registro', datos),
  sesion: () => pedir('GET', '/sesion'),
  logout: () => pedir('POST', '/logout'),

  // Catálogo (público)
  platillos: (filtros) => pedir('GET', `/mongo/platillos${qs(filtros)}`),
  planes: (precioMin) => pedir('GET', `/mongo/planes${qs({ precioMin })}`),
  restaurantes: () => pedir('GET', '/mongo/restaurantes'),
  restaurante: (id) => pedir('GET', `/mongo/restaurantes/${id}`),
  alimentos: () => pedir('GET', '/mongo/nutricion/alimentos'),
  calcularNutricion: (datos) => pedir('POST', '/mongo/nutricion/calcular', datos),

  // Avisos (todos los roles)
  notificaciones: () => pedir('GET', '/mongo/notificaciones'),
  marcarLeidas: (ids) => pedir('PUT', '/mongo/notificaciones/leidas', ids ? { ids } : {}),

  // Pedidos (cada rol ve los suyos)
  pedidos: (estado) => pedir('GET', `/mongo/pedidos${qs({ estado })}`),

  // Cliente
  crearPedido: (items, pago) => pedir('POST', '/mongo/pedidos', { items, pago }),
  consumo: () => pedir('GET', '/mongo/usuarios/consumo'),
  contratarPlan: (plan_id, pago) => pedir('POST', '/mongo/planes/contratar', { plan_id, pago }),
  cancelarPlan: () => pedir('DELETE', '/mongo/planes/contrato'),
  evaluar: (datos) => pedir('POST', '/mongo/pedidos/evaluar', datos),
  actualizarPerfil: (datos) => pedir('PUT', '/mongo/usuarios/biometrico', datos),
  eliminarCuenta: (id) => pedir('DELETE', `/mongo/usuarios/${id}`),

  // Restaurante
  crearPlatillo: (datos) => pedir('POST', '/mongo/platillos', datos),
  misPlatillos: () => pedir('GET', '/mongo/platillos/mios'),
  estadoPlatillo: (id, activo) => pedir('PUT', `/mongo/platillos/${id}/estado`, { activo }),
  cambiarStock: (id, stock) => pedir('PUT', `/mongo/platillos/${id}/stock`, { stock }),
  miLocal: () => pedir('GET', '/mongo/restaurantes/mi-local'),
  subirFotoCocina: (datos) => pedir('POST', '/mongo/restaurantes/fotos', datos),
  eliminarFotoCocina: (id) => pedir('DELETE', `/mongo/restaurantes/fotos/${id}`),
  cambiarEstado: (codigo_pedido, nuevo_estado, repartidor_id) => pedir('PUT', '/mongo/pedidos/estado', { codigo_pedido, nuevo_estado, repartidor_id }),
  repartidores: () => pedir('GET', '/mongo/repartidores'),
  actualizarLocal: (datos) => pedir('PUT', '/mongo/restaurantes/mi-local', datos),

  // Repartidor
  aceptar: (codigo_pedido) => pedir('PUT', '/mongo/pedidos/aceptar', { codigo_pedido }),
  validarPin: (codigo_pedido, pin_ingresado) => pedir('POST', '/mongo/pedidos/validar-pin', { codigo_pedido, pin_ingresado }),
  avisarCerca: (codigo_pedido) => pedir('PUT', '/mongo/pedidos/cerca', { codigo_pedido }),
  disponibilidad: (estado) => pedir('PUT', '/mongo/repartidores/disponibilidad', { estado })
};

// Teléfono: exactamente 11 dígitos (se permite "+" al inicio y espacios o guiones al escribir)
export const telefonoValido = (t) => /^\+?\d{11}$/.test(String(t ?? '').replace(/[\s-]/g, ''));
export const MENSAJE_TELEFONO = 'Número incompleto: debe tener 11 dígitos (ej. +569 1234 5678).';

// Formatos chilenos
export const clp = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
export const fecha = (f) => new Date(f).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
export const decimal = (n, d = 1) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
