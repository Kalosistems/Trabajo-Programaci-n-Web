import { createContext, useContext, useEffect, useState } from 'react';
import { Dropdown, Form } from 'react-bootstrap';

// Accesibilidad (RNF-08, WCAG 2.1): alto contraste y texto grande, guardados en el navegador
const Contexto = createContext(null);
const CLAVE = 'kalo_accesibilidad';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };

export function ProveedorAccesibilidad({ children }) {
  const [pref, setPref] = useState(() => ({ contraste: false, textoGrande: false, ...leer() }));
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('a11y-contraste', pref.contraste);
    html.classList.toggle('a11y-texto-grande', pref.textoGrande);
    try { localStorage.setItem(CLAVE, JSON.stringify(pref)); } catch { /* sin almacenamiento */ }
  }, [pref]);
  return <Contexto.Provider value={[pref, setPref]}>{children}</Contexto.Provider>;
}

// Botón con las opciones de accesibilidad
export function BotonAccesibilidad({ claro = false }) {
  const [pref, setPref] = useContext(Contexto);
  return (
    <Dropdown align="end">
      <Dropdown.Toggle variant={claro ? 'outline-light' : 'light'} size="sm" className="border-0 sin-flecha" aria-label="Opciones de accesibilidad">
        <i className="bi bi-universal-access-circle fs-5" aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="p-3" style={{ minWidth: 240 }}>
        <div className="fw-semibold small mb-2">Accesibilidad</div>
        <Form.Check type="switch" id="a11y-contraste" label="Alto contraste" checked={pref.contraste} onChange={(e) => setPref({ ...pref, contraste: e.target.checked })} />
        <Form.Check type="switch" id="a11y-texto" label="Texto más grande" checked={pref.textoGrande} onChange={(e) => setPref({ ...pref, textoGrande: e.target.checked })} />
      </Dropdown.Menu>
    </Dropdown>
  );
}

// Aviso cuando el dispositivo pierde la conexión (RNF-04: la app no queda "colgada" sin explicación)
export function AvisoSinConexion() {
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (enLinea) return null;
  return (
    <div className="aviso-sin-conexion text-center small py-2" role="alert">
      <i className="bi bi-wifi-off me-2" aria-hidden="true" />Sin conexión a internet. Tus datos se actualizarán cuando vuelva la señal.
    </div>
  );
}
