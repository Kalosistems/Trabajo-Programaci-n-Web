import { createContext, useCallback, useContext, useState } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';

const AvisosContexto = createContext(null);
let siguienteId = 1;

// Mensajes temporales (Toast de Bootstrap), anunciados a lectores de pantalla
export function ProveedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);
  const cerrar = useCallback((id) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const avisar = useCallback((mensaje, tipo = 'exito') => {
    const id = siguienteId++;
    setAvisos((a) => [...a.slice(-2), { id, mensaje, tipo }]);
  }, []);

  const estilo = { exito: ['success', 'check-circle-fill'], error: ['danger', 'exclamation-triangle-fill'], info: ['primary', 'info-circle-fill'] };

  return (
    <AvisosContexto.Provider value={avisar}>
      {children}
      <ToastContainer position="top-center" className="p-3 aviso-contenedor" role="status" aria-live="polite">
        {avisos.map((a) => {
          const [bg, icono] = estilo[a.tipo] || estilo.info;
          return (
            <Toast key={a.id} bg={bg} onClose={() => cerrar(a.id)} delay={a.tipo === 'error' ? 7000 : 4000} autohide>
              <Toast.Body className="d-flex align-items-start gap-2 text-white">
                <i className={`bi bi-${icono} fs-5`} aria-hidden="true" />
                <span className="flex-grow-1">{a.mensaje}</span>
                <button type="button" className="btn-close btn-close-white" onClick={() => cerrar(a.id)} aria-label="Cerrar mensaje" />
              </Toast.Body>
            </Toast>
          );
        })}
      </ToastContainer>
    </AvisosContexto.Provider>
  );
}

export const useAvisos = () => useContext(AvisosContexto);
