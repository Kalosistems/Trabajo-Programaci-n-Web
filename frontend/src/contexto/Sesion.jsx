import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/cliente';

const SesionContexto = createContext(null);

// Pantalla de inicio de cada rol después de iniciar sesión
export const INICIO_POR_ROL = { cliente: '/explorar', restaurante: '/local/pedidos', repartidor: '/reparto' };

// La sesión vive en una cookie httpOnly. Aquí solo se guardan, en memoria, los datos públicos del
// usuario: al abrir la app se le pregunta al servidor quién está conectado (GET /api/sesion).
export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [revisando, setRevisando] = useState(true);
  const [avisoVencida, setAvisoVencida] = useState('');

  useEffect(() => {
    // Las versiones anteriores guardaban el token en localStorage: se borra
    try { localStorage.removeItem('kalo_sesion'); } catch { /* sin almacenamiento */ }
    api.sesion()
      .then((r) => setUsuario(r.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setRevisando(false));
  }, []);

  const entrar = useCallback((respuesta) => {
    setUsuario(respuesta.usuario);
    setAvisoVencida('');
    return { usuario: respuesta.usuario };
  }, []);

  // Cierra la sesión en el servidor (se revoca en PostgreSQL y se borra la cookie)
  const salir = useCallback(() => {
    setUsuario(null);
    api.logout().catch(() => { /* la sesión ya no existía */ });
  }, []);

  const actualizarUsuario = useCallback((cambios) => setUsuario((u) => (u ? { ...u, ...cambios } : u)), []);

  // Si la API responde 401 (sesión vencida o cerrada), se vuelve al login con un aviso
  useEffect(() => {
    const alVencer = (e) => { setAvisoVencida(e.detail); setUsuario(null); };
    window.addEventListener('kalo:sesion-vencida', alVencer);
    return () => window.removeEventListener('kalo:sesion-vencida', alVencer);
  }, []);

  const valor = useMemo(() => ({
    usuario, rol: usuario?.rol, revisando, entrar, salir, actualizarUsuario, avisoVencida
  }), [usuario, revisando, entrar, salir, actualizarUsuario, avisoVencida]);

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export const useSesion = () => useContext(SesionContexto);
