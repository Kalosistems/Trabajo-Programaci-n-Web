import { Badge, ProgressBar } from 'react-bootstrap';

// Índice de Transparencia (RF-09, RF-10): color según el puntaje y sello al 100 %
export function Transparencia({ valor = 0, grande = false }) {
  const v = Math.round(valor);
  const color = v >= 90 ? 'success' : v >= 70 ? 'warning' : 'danger';
  if (grande) {
    return (
      <div>
        <div className="d-flex justify-content-between small fw-semibold mb-1">
          <span><i className="bi bi-patch-check-fill text-success me-1" aria-hidden="true" />Índice de Transparencia</span><span>{v} %</span>
        </div>
        <ProgressBar now={v} variant={color} aria-label={`Índice de Transparencia ${v} %`} style={{ height: 10 }} />
        {v === 100 && <Badge bg="success" className="mt-2">Receta 100 % transparente</Badge>}
      </div>
    );
  }
  return <Badge bg={color} text={color === 'warning' ? 'dark' : undefined} className="rounded-pill"><i className="bi bi-patch-check-fill me-1" aria-hidden="true" />{v} %</Badge>;
}

const COLOR_ESTADO = {
  Pendiente: 'secondary', Pagado: 'info', 'En Preparación': 'warning', 'En Camino': 'primary', Entregado: 'success', Cancelado: 'danger'
};
export function EstadoPedido({ estado }) {
  const c = COLOR_ESTADO[estado] || 'secondary';
  return <Badge bg={c} text={c === 'warning' || c === 'info' ? 'dark' : undefined} className="rounded-pill">{estado}</Badge>;
}

// Imagen del platillo con respaldo local si el enlace externo falla
export function ImagenPlatillo({ src, alt, className = '' }) {
  return (
    <img
      src={src || '/platillo.svg'} alt={alt} loading="lazy" className={`img-platillo w-100 ${className}`}
      onError={(e) => { if (!e.currentTarget.src.endsWith('/platillo.svg')) e.currentTarget.src = '/platillo.svg'; }}
    />
  );
}

export function Estrellas({ valor = 0, alCambiar, etiqueta }) {
  return (
    <div role={alCambiar ? 'radiogroup' : undefined} aria-label={etiqueta} className="d-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (alCambiar ? (
        <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`}
          className="btn btn-link p-0 fs-3 text-warning" onClick={() => alCambiar(n)}>
          <i className={`bi bi-star${n <= valor ? '-fill' : ''}`} aria-hidden="true" />
        </button>
      ) : <i key={n} className={`bi bi-star${n <= valor ? '-fill' : ''} text-warning`} aria-hidden="true" />))}
    </div>
  );
}
