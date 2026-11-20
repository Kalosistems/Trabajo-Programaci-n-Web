import { useCallback, useEffect, useRef, useState } from 'react';

// Carga datos de la API y expone { datos, error, cargando, recargar }.
// Con "cadaMs" vuelve a consultar cada cierto tiempo (seguimiento y pedidos entrantes).
export function useCarga(funcion, dependencias = [], { cadaMs } = {}) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: true });
  const fn = useRef(funcion);
  fn.current = funcion;

  const recargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado((e) => ({ ...e, cargando: true, error: null }));
    try {
      const r = await fn.current();
      setEstado({ datos: r.datos, error: null, cargando: false });
      return r.datos;
    } catch (error) {
      setEstado((e) => ({ datos: silencioso ? e.datos : null, error, cargando: false }));
      return null;
    }
  }, []);

  useEffect(() => {
    recargar();
    if (!cadaMs) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') recargar(true); }, cadaMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return { ...estado, recargar };
}

// Ejecuta una acción (POST/PUT...) y maneja el estado "enviando"
export function useAccion() {
  const [enviando, setEnviando] = useState(false);
  const ejecutar = useCallback(async (promesa) => {
    setEnviando(true);
    try { return await promesa(); } finally { setEnviando(false); }
  }, []);
  return { enviando, ejecutar };
}

// Título de la pestaña (ayuda a lectores de pantalla y al historial del navegador)
export function useTitulo(titulo) {
  useEffect(() => { document.title = titulo ? `${titulo} · Kalo` : 'Kalo · Comida saludable y transparente'; }, [titulo]);
}
