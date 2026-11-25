import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { api, clp, fecha } from '../../api/cliente';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto } from '../../componentes/Estados';

const COLUMNAS = [
  { estado: 'Pagado', titulo: 'Pagados', icono: 'credit-card', color: 'info' },
  { estado: 'En Preparación', titulo: 'En preparación', icono: 'fire', color: 'warning' },
  { estado: 'En Camino', titulo: 'En camino', icono: 'scooter', color: 'primary' },
  { estado: 'Entregado', titulo: 'Entregados', icono: 'check2-circle', color: 'success' }
];

// Tablero de pedidos entrantes (RF-20). Se actualiza solo cada 10 s y avisa cuando llega un pedido nuevo.
export default function PedidosLocal() {
  useTitulo('Pedidos entrantes');
  const avisar = useAvisos();
  const { enviando, ejecutar } = useAccion();
  const { datos, error, cargando, recargar } = useCarga(() => api.pedidos(), [], { cadaMs: 10000 });
  const [despachar, setDespachar] = useState(null);
  const [repartidores, setRepartidores] = useState([]);
  const [repartidor, setRepartidor] = useState('');
  const [rechazar, setRechazar] = useState(null);
  const vistos = useRef(null);

  useEffect(() => {
    if (!datos) return;
    const ids = new Set(datos.map((p) => p._id));
    if (vistos.current) {
      const nuevos = datos.filter((p) => !vistos.current.has(p._id));
      if (nuevos.length) avisar(`🔔 ${nuevos.length === 1 ? 'Nuevo pedido' : `${nuevos.length} pedidos nuevos`}: ${nuevos[0].codigo_pedido}`, 'info');
    }
    vistos.current = ids;
  }, [datos, avisar]);

  const cambiar = async (p, estado) => {
    try {
      const r = await ejecutar(() => api.cambiarEstado(p.codigo_pedido, estado));
      avisar(r.mensaje); recargar(true);
    } catch (e) { avisar(e.message, 'error'); }
  };

  const abrirDespacho = async (p) => {
    setDespachar(p); setRepartidor('');
    try { const r = await api.repartidores(); setRepartidores(r.datos); setRepartidor(r.datos[0]?._id || ''); } catch (e) { avisar(e.message, 'error'); }
  };

  const confirmarDespacho = async () => {
    try {
      const r = await ejecutar(() => api.cambiarEstado(despachar.codigo_pedido, 'En Camino', repartidor || undefined));
      avisar(r.mensaje); setDespachar(null); recargar(true);
    } catch (e) { avisar(e.message, 'error'); }
  };

  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div><h1 className="h3 mb-0">Pedidos entrantes</h1><small className="text-secondary"><i className="bi bi-arrow-repeat me-1" />Se actualiza cada 10 segundos</small></div>
        <Button variant="outline-primary" size="sm" onClick={() => recargar()}><i className="bi bi-arrow-clockwise me-1" />Actualizar</Button>
      </div>
      {cargando ? <Esqueleto filas={2} /> : (
        <Row className="g-3">
          {COLUMNAS.map((col) => {
            const lista = (datos || []).filter((p) => p.estado === col.estado);
            return (
              <Col md={6} xl={3} key={col.estado}>
                <div className="columna-kanban p-2 h-100">
                  <div className="d-flex justify-content-between align-items-center px-2 py-1 mb-2">
                    <span className="fw-bold"><i className={`bi bi-${col.icono} me-1 text-${col.color}`} />{col.titulo}</span>
                    <Badge bg={col.color} text={['warning', 'info'].includes(col.color) ? 'dark' : undefined} pill>{lista.length}</Badge>
                  </div>
                  {!lista.length && <p className="small text-secondary text-center py-4 mb-0">Sin pedidos</p>}
                  {lista.slice(0, 12).map((p) => (
                    <Card key={p._id} className="mb-2">
                      <Card.Body className="p-3">
                        <div className="d-flex justify-content-between"><strong>#{p.codigo_pedido.split('-').pop()}</strong><small className="text-secondary">{fecha(p.fecha_pedido).split(',')[1]}</small></div>
                        <div className="small">{p.cliente?.nombre}{p.total_calorias > 0 && <span className="text-secondary"> · {p.total_calorias} kcal</span>}</div>
                        <ul className="small text-secondary ps-3 mb-2 mt-1">{p.detalles?.map((d) => <li key={d.platillo_id}>{d.cantidad} × {d.nombre_platillo}</li>)}</ul>
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
                          <span className="fw-semibold">{clp(p.total)}</span>
                          {p.estado === 'Pagado' && (
                            <div className="d-flex gap-1">
                              <Button size="sm" variant="outline-danger" onClick={() => setRechazar(p)} disabled={enviando} aria-label={`Rechazar pedido ${p.codigo_pedido}`}><i className="bi bi-x-lg" /></Button>
                              <Button size="sm" onClick={() => cambiar(p, 'En Preparación')} disabled={enviando}>Aceptar</Button>
                            </div>
                          )}
                          {p.estado === 'En Preparación' && <Button size="sm" variant="warning" onClick={() => abrirDespacho(p)}>Despachar</Button>}
                          {p.estado === 'En Camino' && <small className="text-secondary"><i className="bi bi-scooter me-1" />{p.repartidor_id?.nombre || 'Sin asignar'}</small>}
                          {p.estado === 'Entregado' && p.evaluacion?.calificacion_general && <small><i className="bi bi-star-fill text-warning" /> {p.evaluacion.calificacion_general}</small>}
                        </div>
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Rechazar: el pedido se cancela y el pago se reembolsa */}
      <Modal show={!!rechazar} onHide={() => setRechazar(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Rechazar el pedido #{rechazar?.codigo_pedido.split('-').pop()}?</Modal.Title></Modal.Header>
        <Modal.Body>Le avisaremos a {rechazar?.cliente?.nombre} y se reembolsará su pago. Úsalo solo si no puedes preparar el pedido.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setRechazar(null)}>Volver</Button>
          <Button variant="danger" disabled={enviando} onClick={async () => { await cambiar(rechazar, 'Cancelado'); setRechazar(null); }}>Rechazar pedido</Button>
        </Modal.Footer>
      </Modal>

      {/* Confirmar la salida: al despachar se genera el PIN (RF-15), que solo ve el cliente */}
      <Modal show={!!despachar} onHide={() => setDespachar(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿El pedido #{despachar?.codigo_pedido.split('-').pop()} está listo para salir?</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group controlId="repartidor">
            <Form.Label>Repartidor</Form.Label>
            <Form.Select value={repartidor} onChange={(e) => setRepartidor(e.target.value)}>
              {repartidores.map((r) => <option key={r._id} value={r._id}>{r.nombre} · {r.vehiculo} · {r.estado}</option>)}
              <option value="">Que lo tome el primer repartidor disponible</option>
            </Form.Select>
          </Form.Group>
          <p className="small text-secondary mt-3 mb-0"><i className="bi bi-shield-lock me-1" />Al confirmar se genera el PIN de 4 dígitos. Solo lo verá el cliente.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDespachar(null)}>Todavía no</Button>
          <Button onClick={confirmarDespacho} disabled={enviando}>{enviando ? <Spinner size="sm" /> : 'Confirmar salida'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
