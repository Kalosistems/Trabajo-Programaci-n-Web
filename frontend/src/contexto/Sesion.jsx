import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { guardarSesion, leerSesion } from '../api/cliente';

const SesionContexto = createContext(null);

// Pantalla de inicio de cada rol después de iniciar sesión
export const INICIO_POR_ROL = { cliente: '/explorar', restaurante: '/local/pedidos', repartidor: '/reparto' };

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const [avisoVencida, setAvisoVencida] = useState('');

  const entrar = useCallback((respuesta) => {
    const nueva = { token: respuesta.token, usuario: respuesta.usuario };
    guardarSesion(nueva);
    setSesion(nueva);
    setAvisoVencida('');
    return nueva;
  }, []);

  const salir = useCallback(() => {
    guardarSesion(null);
    setSesion(null);
  }, []);

  const actualizarUsuario = useCallback((cambios) => {
    setSesion((s) => {
      const nueva = { ...s, usuario: { ...s.usuario, ...cambios } };
      guardarSesion(nueva);
      return nueva;
    });
  }, []);

  // Si la API responde 401 (token vencido), se cierra la sesión y se avisa en el login
  useEffect(() => {
    const alVencer = (e) => { setAvisoVencida(e.detail); salir(); };
    window.addEventListener('kalo:sesion-vencida', alVencer);
    return () => window.removeEventListener('kalo:sesion-vencida', alVencer);
  }, [salir]);

  const valor = useMemo(() => ({
    sesion, usuario: sesion?.usuario, rol: sesion?.usuario?.rol, entrar, salir, actualizarUsuario, avisoVencida
  }), [sesion, entrar, salir, actualizarUsuario, avisoVencida]);

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export const useSesion = () => useContext(SesionContexto);
