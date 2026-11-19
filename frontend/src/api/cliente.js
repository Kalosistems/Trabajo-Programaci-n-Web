// Cliente HTTP de Kalo: todas las pantallas llaman a la API REST a través de estas funciones.
// La API responde { exito: true, ... } o { exito: false, codigo, mensaje } (ver docs/API.md).
const CLAVE_SESION = 'kalo_sesion';

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

export function leerSesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE_SESION)) || null; } catch { return null; }
}
export function guardarSesion(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE_SESION);
  } catch { /* modo privado: la sesión dura mientras la pestaña esté abierta */ }
}

async function pedir(metodo, ruta, cuerpo) {
  const sesion = leerSesion();
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(sesion?.token ? { Authorization: `Bearer ${sesion.token}` } : {})
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No pudimos conectar con Kalo. Revisa tu conexión e intenta de nuevo.');
  }

  let json = null;
  try { json = await respuesta.json(); } catch { /* respuesta vacía */ }

  if (!respuesta.ok || !json?.exito) {
    const err = new ErrorApi(respuesta.status, json?.codigo || 'ERROR', json?.mensaje || `El servidor respondió con error ${respuesta.status}.`);
    // Token vencido o inválido: la app vuelve al inicio de sesión
    if (respuesta.status === 401 && sesion?.token && ['NO_AUTENTICADO', 'TOKEN_INVALIDO', 'SESION_VENCIDA'].includes(err.codigo)) {
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

  // Catálogo (público)
  platillos: (filtros) => pedir('GET', `/mongo/platillos${qs(filtros)}`),
  planes: (precioMin) => pedir('GET', `/mongo/planes${qs({ precioMin })}`),

  // Pedidos (cada rol ve los suyos)
  pedidos: (estado) => pedir('GET', `/mongo/pedidos${qs({ estado })}`),

  // Cliente
  crearPedido: (items) => pedir('POST', '/mongo/pedidos', { items }),
  evaluar: (datos) => pedir('POST', '/mongo/pedidos/evaluar', datos),
  actualizarPerfil: (datos) => pedir('PUT', '/mongo/usuarios/biometrico', datos),
  eliminarCuenta: (id) => pedir('DELETE', `/mongo/usuarios/${id}`),

  // Restaurante
  crearPlatillo: (datos) => pedir('POST', '/mongo/platillos', datos),
  cambiarEstado: (codigo_pedido, nuevo_estado, repartidor_id) => pedir('PUT', '/mongo/pedidos/estado', { codigo_pedido, nuevo_estado, repartidor_id }),
  repartidores: () => pedir('GET', '/mongo/repartidores'),
  actualizarLocal: (datos) => pedir('PUT', '/mongo/restaurantes/mi-local', datos),

  // Repartidor
  aceptar: (codigo_pedido) => pedir('PUT', '/mongo/pedidos/aceptar', { codigo_pedido }),
  validarPin: (codigo_pedido, pin_ingresado) => pedir('POST', '/mongo/pedidos/validar-pin', { codigo_pedido, pin_ingresado }),

  // Consola NoSQL: ejecuta cualquier consulta GET y devuelve también el status HTTP
  consulta: async (ruta) => {
    try { const r = await pedir('GET', ruta); return { status: 200, json: r }; } catch (e) {
      return { status: e.status, json: { exito: false, codigo: e.codigo, mensaje: e.message } };
    }
  }
};

// Formatos chilenos
export const clp = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;
export const fecha = (f) => new Date(f).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
export const decimal = (n, d = 1) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
