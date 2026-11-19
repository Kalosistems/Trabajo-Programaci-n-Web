import { Card, Col, ListGroup, Row } from 'react-bootstrap';
import { api, clp, fecha } from '../../api/cliente';
import { useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { Estrellas } from '../../componentes/Insignias';

export default function Resumen() {
  useTitulo('Resumen');
  const { datos, error, cargando, recargar } = useCarga(() => api.pedidos(), []);
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;
  if (cargando) return <Esqueleto filas={2} />;

  const pedidos = datos || [];
  const entregados = pedidos.filter((p) => p.estado === 'Entregado');
  const evaluados = entregados.filter((p) => p.evaluacion?.calificacion_general);
  const prom = (k) => (evaluados.length ? evaluados.reduce((s, p) => s + (p.evaluacion[k] || 0), 0) / evaluados.length : 0);
  const kpis = [
    ['receipt', 'Pedidos', pedidos.length],
    ['check2-circle', 'Entregados', entregados.length],
    ['cash-coin', 'Ventas entregadas', clp(entregados.reduce((s, p) => s + p.total, 0))],
    ['star-fill', 'Nota promedio', evaluados.length ? prom('calificacion_general').toFixed(1).replace('.', ',') : '—']
  ];

  return (
    <>
      <h1 className="h3 mb-3">Resumen y evaluaciones</h1>
      <Row xs={2} lg={4} className="g-3 mb-4">
        {kpis.map(([i, t, v]) => (
          <Col key={t}><Card className="h-100"><Card.Body>
            <i className={`bi bi-${i} text-verde fs-4`} aria-hidden="true" /><div className="small text-secondary mt-1">{t}</div><div className="fs-4 fw-bold">{v}</div>
          </Card.Body></Card></Col>
        ))}
      </Row>
      <Row className="g-3">
        <Col lg={5}>
          <Card><Card.Body>
            <h2 className="h6">Cómo te evalúan</h2>
            {[['similitud_foto', 'Similitud con la foto'], ['gramaje_porcion', 'Porción real'], ['velocidad_prep', 'Velocidad']].map(([k, t]) => (
              <div key={k} className="d-flex justify-content-between align-items-center py-2 border-bottom"><span className="small">{t}</span><Estrellas valor={Math.round(prom(k))} /></div>
            ))}
          </Card.Body></Card>
        </Col>
        <Col lg={7}>
          <Card><Card.Body>
            <h2 className="h6">Últimos comentarios</h2>
            {!evaluados.length ? <Vacio icono="chat-square-text" titulo="Aún no hay evaluaciones" /> : (
              <ListGroup variant="flush">
                {evaluados.slice(0, 6).map((p) => (
                  <ListGroup.Item key={p._id} className="px-0">
                    <div className="d-flex justify-content-between"><strong className="small">{p.cliente?.nombre}</strong><Estrellas valor={p.evaluacion.calificacion_general} /></div>
                    <div className="small">{p.evaluacion.comentario || <span className="text-secondary">Sin comentario</span>}</div>
                    <small className="text-secondary">{fecha(p.evaluacion.fecha_evaluacion || p.fecha_pedido)}</small>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card.Body></Card>
        </Col>
      </Row>
    </>
  );
}
