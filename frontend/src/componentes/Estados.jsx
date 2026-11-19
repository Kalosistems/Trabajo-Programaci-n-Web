import { Alert, Button, Placeholder, Spinner } from 'react-bootstrap';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="d-flex align-items-center justify-content-center gap-2 py-5 text-secondary" role="status">
      <Spinner animation="border" size="sm" variant="success" /> {texto}
    </div>
  );
}

// Tarjetas "fantasma" mientras llegan los datos
export function Esqueleto({ filas = 3 }) {
  return (
    <div className="d-grid gap-3" aria-hidden="true">
      {Array.from({ length: filas }).map((_, i) => (
        <Placeholder key={i} as="div" animation="glow" className="card p-3">
          <Placeholder xs={7} /> <Placeholder xs={4} /> <Placeholder xs={9} size="sm" />
        </Placeholder>
      ))}
    </div>
  );
}

export function Vacio({ icono = 'inbox', titulo, texto, children }) {
  return (
    <div className="text-center py-5 px-3">
      <i className={`bi bi-${icono} display-5 text-secondary`} aria-hidden="true" />
      <h2 className="h5 mt-3">{titulo}</h2>
      {texto && <p className="text-secondary mb-3">{texto}</p>}
      {children}
    </div>
  );
}

export function ErrorCarga({ error, alReintentar }) {
  return (
    <Alert variant="danger" className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
      <span><i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />{error?.message || 'No pudimos cargar la información.'}</span>
      {alReintentar && <Button size="sm" variant="outline-danger" onClick={() => alReintentar()}>Reintentar</Button>}
    </Alert>
  );
}
