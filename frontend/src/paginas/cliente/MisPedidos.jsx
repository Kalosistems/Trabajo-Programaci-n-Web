import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Form, ListGroup, Modal, Row, Spinner } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { api, clp, fecha } from '../../api/cliente';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { EstadoPedido, Estrellas } from '../../componentes/Insignias';

const PASOS = ['Pagado', 'En Preparación', 'En Camino', 'Entregado'];
const NOMBRE_PASO = { Pagado: 'Pagado', 'En Preparación': 'En preparación', 'En Camino': 'En camino', Entregado: 'Entregado' };

function Pasos({ estado }) {
  const actual = PASOS.indexOf(estado);
  return (
    <div className="pasos my-3" aria-label={`Estado del pedido: ${estado}`}>
      {PASOS.map((p, i) => (
        <div key={p} className={`paso ${i <= actual ? 'hecho' : ''}`}>
          <div className="circulo">{i < actual || estado === 'Entregado' ? <i className="bi bi-check-lg" /> : i + 1}</div>
          {NOMBRE_PASO[p]}
        </div>
      ))}
    </div>
  );
}

function Seguimiento({ pedido, alEvaluar }) {
  return (
    <Card className="shadow-sm">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <small className="text-secondary">Pedido {pedido.codigo_pedido}</small>
            <h2 className="h5 mb-0">{pedido.restaurante_id?.nombre || 'Restaurante'}</h2>
          </div>
          <EstadoPedido estado={pedido.estado} />
        </div>
        {pedido.estado === 'Cancelado' ? <p className="text-danger mt-3">Este pedido fue cancelado por el local.</p> : <Pasos estado={pedido.estado} />}

        {pedido.estado === 'En Preparación' && (
          <div className="bg-verde-claro rounded-3 p-3 small"><i className="bi bi-hourglass-split me-1" />El local está preparando tu comida. Verás tu PIN cuando salga.</div>
        )}
        {pedido.estado === 'En Camino' && (
          <div className="caja-pin rounded-4 p-3 text-center">
            <div className="small fw-semibold text-warning-emphasis"><i className="bi bi-shield-lock-fill me-1" />Tu PIN de entrega</div>
            <div className="pin-grande my-1" aria-label={`PIN ${pedido.pin_seguridad?.split('').join(' ')}`}>{pedido.pin_seguridad || '----'}</div>
            <div className="small">Díctaselo al repartidor solo cuando tengas tu pedido en la mano.</div>
            {pedido.repartidor_id && <div className="small mt-2"><i className="bi bi-scooter me-1" />{pedido.repartidor_id.nombre} · {pedido.repartidor_id.vehiculo}</div>}
          </div>
        )}
        {pedido.estado === 'Entregado' && (
          pedido.evaluacion?.calificacion_general
            ? <div className="d-flex align-items-center gap-2 small"><span>Tu evaluación:</span><Estrellas valor={pedido.evaluacion.calificacion_general} /></div>
            : <Button variant="warning" className="w-100" onClick={() => alEvaluar(pedido)}><i className="bi bi-star-fill me-1" />Evaluar pedido</Button>
        )}

        <ListGroup variant="flush" className="mt-3 small">
          {pedido.detalles?.map((d) => (
            <ListGroup.Item key={d.platillo_id} className="d-flex justify-content-between px-0">
              <span>{d.cantidad} × {d.nombre_platillo}</span><span>{clp(d.subtotal)}</span>
            </ListGroup.Item>
          ))}
          <ListGroup.Item className="d-flex justify-content-between px-0"><span>Envío</span><span>{clp(1490)}</span></ListGroup.Item>
          <ListGroup.Item className="d-flex justify-content-between px-0 fw-bold"><span>Total pagado</span><span>{clp(pedido.total)}</span></ListGroup.Item>
        </ListGroup>
      </Card.Body>
    </Card>
  );
}

const CRITERIOS = [
  ['similitud_foto', '¿Se parecía a la foto?'],
  ['gramaje_porcion', '¿La porción era la indicada?'],
  ['velocidad_prep', '¿Qué tan rápido llegó?'],
  ['calificacion_general', 'Calificación general']
];

export default function MisPedidos() {
  useTitulo('Mis pedidos');
  const avisar = useAvisos();
  const codigoNuevo = useLocation().state?.codigo;
  const [filtro, setFiltro] = useState('curso');
  const [elegido, setElegido] = useState(codigoNuevo || null);
  const [evaluando, setEvaluando] = useState(null);
  const [notas, setNotas] = useState({});
  const [comentario, setComentario] = useState('');
  const { enviando, ejecutar } = useAccion();
  // Se consulta cada 10 s para ver el avance y el PIN apenas el local despacha
  const { datos, error, cargando, recargar } = useCarga(() => api.pedidos(), [], { cadaMs: 10000 });

  const pedidos = datos || [];
  const enCurso = pedidos.filter((p) => !['Entregado', 'Cancelado'].includes(p.estado));
  const lista = filtro === 'curso' ? enCurso : pedidos.filter((p) => ['Entregado', 'Cancelado'].includes(p.estado));
  const actual = pedidos.find((p) => p.codigo_pedido === elegido) || lista[0];

  useEffect(() => { if (!cargando && !enCurso.length && filtro === 'curso' && pedidos.length) setFiltro('historial'); }, [cargando]); // eslint-disable-line

  const enviarEvaluacion = async () => {
    try {
      await ejecutar(() => api.evaluar({ codigo_pedido: evaluando.codigo_pedido, ...notas, comentario }));
      avisar('¡Gracias! Tu evaluación ayuda a mantener el Índice de Transparencia.');
      setEvaluando(null); recargar(true);
    } catch (e) { avisar(e.message, 'error'); }
  };

  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;
  if (cargando) return <Esqueleto filas={2} />;
  if (!pedidos.length) {
    return <Vacio icono="bag" titulo="Aún no tienes pedidos" texto="Cuando pidas, aquí verás el avance y tu PIN de entrega."><Button as={Link} to="/explorar">Explorar platillos</Button></Vacio>;
  }

  return (
    <>
      <h1 className="h3">Mis pedidos</h1>
      <div className="btn-group mb-3" role="group">
        <Button variant={filtro === 'curso' ? 'primary' : 'outline-primary'} onClick={() => setFiltro('curso')}>En curso <Badge bg="light" text="dark">{enCurso.length}</Badge></Button>
        <Button variant={filtro === 'historial' ? 'primary' : 'outline-primary'} onClick={() => setFiltro('historial')}>Historial</Button>
      </div>
      {!lista.length ? <Vacio icono="check2-circle" titulo="No tienes pedidos en curso" /> : (
        <Row className="g-3">
          <Col lg={5}>
            <ListGroup>
              {lista.map((p) => (
                <ListGroup.Item key={p._id} action active={actual?._id === p._id} onClick={() => setElegido(p.codigo_pedido)} className="d-flex justify-content-between align-items-center">
                  <div><div className="fw-semibold">{p.restaurante_id?.nombre}</div><small>{fecha(p.fecha_pedido)} · {clp(p.total)}</small></div>
                  <EstadoPedido estado={p.estado} />
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Col>
          <Col lg={7}>{actual && <Seguimiento pedido={actual} alEvaluar={(p) => { setEvaluando(p); setNotas({}); setComentario(''); }} />}</Col>
        </Row>
      )}

      {/* Evaluación post-entrega (RF-12, RF-13) */}
      <Modal show={!!evaluando} onHide={() => setEvaluando(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">Evaluar pedido</Modal.Title></Modal.Header>
        <Modal.Body>
          {CRITERIOS.map(([k, t]) => (
            <div key={k} className="d-flex justify-content-between align-items-center mb-2 flex-wrap">
              <span className="small fw-semibold">{t}</span>
              <Estrellas valor={notas[k] || 0} alCambiar={(n) => setNotas({ ...notas, [k]: n })} etiqueta={t} />
            </div>
          ))}
          <Form.Group controlId="comentario" className="mt-3">
            <Form.Label className="small">Comentario (opcional)</Form.Label>
            <Form.Control as="textarea" rows={2} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEvaluando(null)}>Ahora no</Button>
          <Button onClick={enviarEvaluacion} disabled={enviando || CRITERIOS.some(([k]) => !notas[k])}>
            {enviando ? <Spinner size="sm" /> : 'Enviar evaluación'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
