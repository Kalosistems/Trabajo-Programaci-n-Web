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
  if (pedido.tipo === 'plan') {
    const pl = pedido.plan_adquirido || {};
    return (
      <Card className="shadow-sm"><Card.Body>
        <small className="text-secondary">Contratación {pedido.codigo_pedido}</small>
        <h2 className="h5"><i className="bi bi-clipboard2-heart text-verde me-2" />Plan {pl.nombre_plan}</h2>
        <p className="mb-2">{pl.calorias_diarias?.toLocaleString('es-CL')} kcal al día · USD {pl.precio_historico}/mes</p>
        {pedido.pago && <p className="small text-secondary mb-0"><i className="bi bi-credit-card me-1" />{pedido.pago.marca} •••• {pedido.pago.ultimos4} · {pedido.pago.estado}</p>}
      </Card.Body></Card>
    );
  }
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

        {pedido.estado === 'Pagado' && (
          <div className="bg-light border rounded-3 p-3 small"><i className="bi bi-hourglass me-1" />Pago aprobado. Esperando que el local acepte tu pedido.</div>
        )}
        {pedido.estado === 'En Preparación' && (
          <div className="bg-verde-claro rounded-3 p-3 small"><i className="bi bi-hourglass-split me-1" />El local está preparando tu comida. Verás tu PIN cuando salga.</div>
        )}
        {pedido.estado === 'En Camino' && (
          <div className="caja-pin rounded-4 p-3 text-center">
            <div className="small fw-semibold text-warning-emphasis"><i className="bi bi-shield-lock-fill me-1" />Tu PIN de entrega</div>
            <div className="pin-grande my-1" aria-label={`PIN ${pedido.pin_seguridad?.split('').join(' ')}`}>{pedido.pin_seguridad || '----'}</div>
            <div className="small">Díctaselo al repartidor solo cuando tengas tu pedido en la mano.</div>
            {pedido.aviso_cercano_en && <div className="alert alert-success py-1 small mt-2 mb-0"><i className="bi bi-geo-alt-fill me-1" />Tu repartidor está a 5 minutos o menos</div>}
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
        <div className="d-flex justify-content-between small text-secondary mt-2 flex-wrap gap-2">
          {pedido.total_calorias > 0 && <span><i className="bi bi-fire text-warning me-1" />{pedido.total_calorias.toLocaleString('es-CL')} kcal</span>}
          {pedido.pago && <span><i className="bi bi-credit-card me-1" />{pedido.pago.marca} •••• {pedido.pago.ultimos4}{pedido.pago.estado === 'Reembolsado' ? ' · Reembolsado' : ''}</span>}
        </div>
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
  const estadoNav = useLocation().state || {};
  const codigoNuevo = estadoNav.codigo;
  const [filtro, setFiltro] = useState('curso');
  const [elegido, setElegido] = useState(codigoNuevo || null);
  const [evaluando, setEvaluando] = useState(null);
  const [notas, setNotas] = useState({});
  const [comentario, setComentario] = useState('');
  const { enviando, ejecutar } = useAccion();
  // Se consulta cada 10 s para ver el avance y el PIN apenas el local despacha
  const { datos, error, cargando, recargar } = useCarga(() => api.pedidos(), [], { cadaMs: 10000 });

  const pedidos = datos || [];
  const terminado = (p) => p.tipo === 'plan' || ['Entregado', 'Cancelado'].includes(p.estado);
  const enCurso = pedidos.filter((p) => !terminado(p));
  const lista = filtro === 'curso' ? enCurso : pedidos.filter(terminado);
  const actual = pedidos.find((p) => p.codigo_pedido === elegido) || lista[0];

  useEffect(() => { if (!cargando && !enCurso.length && filtro === 'curso' && pedidos.length) setFiltro('historial'); }, [cargando]); // eslint-disable-line

  // RF-12: cuando llega el aviso "pedido entregado" (o se abre desde la campana), se abre la evaluación
  const abrirEvaluacion = (codigo) => {
    const p = (datos || []).find((x) => x.codigo_pedido === codigo);
    if (p && p.estado === 'Entregado' && !p.evaluacion?.calificacion_general) {
      setFiltro('historial'); setElegido(codigo); setEvaluando(p); setNotas({}); setComentario('');
    }
  };
  useEffect(() => { if (estadoNav.evaluar && datos) abrirEvaluacion(estadoNav.evaluar); }, [estadoNav.evaluar, !!datos]); // eslint-disable-line
  useEffect(() => {
    const alAviso = async (e) => {
      const lista = await recargar(true);
      if (e.detail.tipo === 'evaluar' && lista) {
        const p = lista.find((x) => x.codigo_pedido === e.detail.codigo_pedido);
        if (p && !p.evaluacion?.calificacion_general) { setFiltro('historial'); setElegido(p.codigo_pedido); setEvaluando(p); setNotas({}); setComentario(''); }
      }
    };
    window.addEventListener('kalo:aviso', alAviso);
    return () => window.removeEventListener('kalo:aviso', alAviso);
  }, [recargar]);

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
                  <div><div className="fw-semibold">{p.tipo === 'plan' ? <><i className="bi bi-clipboard2-heart me-1" />Plan {p.plan_adquirido?.nombre_plan}</> : p.restaurante_id?.nombre}</div><small>{fecha(p.fecha_pedido)} · {p.tipo === 'plan' ? `USD ${p.total}` : clp(p.total)}</small></div>
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
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Cómo estuvo tu pedido?</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="small text-secondary">{evaluando?.restaurante_id?.nombre} · {evaluando?.codigo_pedido}. Tu opinión actualiza el Índice de Transparencia del local.</p>
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
