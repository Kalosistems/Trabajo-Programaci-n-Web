import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, ProgressBar, Row, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { api, decimal, telefonoValido, MENSAJE_TELEFONO } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useAvisos } from '../../contexto/Avisos';
import { useCarrito } from '../../contexto/Carrito';
import { useAccion, useCarga, useTitulo } from '../../hooks';
import { Esqueleto } from '../../componentes/Estados';
import PasarelaPago from '../../componentes/PasarelaPago';
import { ACTIVIDADES, OBJETIVOS, estadoImc, metaCalorica } from '../../utils/transparencia';

export default function Perfil() {
  useTitulo('Mi perfil');
  const { usuario, actualizarUsuario, salir } = useSesion();
  const { vaciar } = useCarrito();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const pb = usuario?.perfil_biometrico || {};
  const plan = usuario?.plan_activo;
  const [f, setF] = useState({
    nombre: usuario?.nombre || '', telefono: usuario?.telefono || '', peso: pb.peso_kg || '', altura: pb.altura_m || '',
    edad: pb.edad || '', genero: pb.genero || 'Otro', nivel_actividad: pb.nivel_actividad || 'ligero', objetivo: pb.objetivo || 'mantener'
  });
  const [borrar, setBorrar] = useState(false);
  const [contratar, setContratar] = useState(null);   // plan elegido → confirmar
  const [pagarPlan, setPagarPlan] = useState(null);   // plan elegido → pasarela
  const [cancelar, setCancelar] = useState(false);
  const guardarA = useAccion();
  const borrarA = useAccion();
  const planA = useAccion();
  const planes = useCarga(() => api.planes(), []);
  const consumo = useCarga(() => api.consumo(), []);
  const [texto, color] = estadoImc(pb.imc || 0);

  const num = (v) => parseFloat(String(v).replace(',', '.'));
  const telMalo = !telefonoValido(f.telefono);
  const metaNueva = metaCalorica({ ...f, peso: num(f.peso), altura: num(f.altura) });

  const guardar = async (e) => {
    e.preventDefault();
    if (telMalo) { avisar(MENSAJE_TELEFONO, 'error'); return; }
    try {
      const r = await guardarA.ejecutar(() => api.actualizarPerfil({ ...f, peso: num(f.peso), altura: num(f.altura) }));
      actualizarUsuario(r.usuario);
      avisar(r.pedidos_actualizados ? `${r.mensaje} (también en ${r.pedidos_actualizados} pedidos)` : r.mensaje);
      consumo.recargar(true);
    } catch (err) { avisar(err.message, 'error'); }
  };

  const pagarYContratar = async (comprobante) => {
    const r = await api.contratarPlan(pagarPlan._id, comprobante);
    actualizarUsuario(r.usuario);
    setPagarPlan(null);
    avisar(r.mensaje);
    consumo.recargar(true);
  };

  const cancelarPlan = async () => {
    try {
      const r = await planA.ejecutar(() => api.cancelarPlan());
      actualizarUsuario(r.usuario); setCancelar(false); avisar(r.mensaje); consumo.recargar(true);
    } catch (err) { avisar(err.message, 'error'); }
  };

  const eliminar = async () => {
    try {
      await borrarA.ejecutar(() => api.eliminarCuenta(usuario.id));
      vaciar(); salir(); navegar('/');
    } catch (err) { avisar(err.message, 'error'); }
  };

  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const cd = consumo.datos;

  return (
    <>
      <h1 className="h3 mb-3">Mi perfil</h1>
      <Row className="g-3">
        <Col lg={4}>
          <Card className="text-center mb-3">
            <Card.Body>
              <div className="avatar mx-auto mb-2">{usuario?.nombre?.[0]}</div>
              <h2 className="h5 mb-0">{usuario?.nombre}</h2>
              <p className="small text-secondary">{usuario?.correo}</p>
              <Row className="g-2">
                <Col xs={6}>
                  <div className="bg-verde-claro rounded-3 p-2 h-100">
                    <div className="fs-3 fw-800 text-verde">{decimal(pb.imc)}</div>
                    <div className="small text-secondary">IMC</div>
                    <Badge bg={color} text={color === 'warning' || color === 'info' ? 'dark' : undefined}>{texto}</Badge>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="bg-verde-claro rounded-3 p-2 h-100">
                    <div className="fs-3 fw-800 text-verde">{(pb.meta_calorica_diaria || 0).toLocaleString('es-CL')}</div>
                    <div className="small text-secondary">kcal/día</div>
                    <Badge bg="light" text="dark" className="border">{plan ? `Plan ${plan.nombre_plan}` : 'Recomendada'}</Badge>
                  </div>
                </Col>
              </Row>
              <p className="small text-secondary mt-3 mb-0">{pb.objetivo_salud}</p>
              {plan && pb.meta_recomendada && <p className="small text-secondary mb-0">Sin plan, tu meta recomendada sería {pb.meta_recomendada.toLocaleString('es-CL')} kcal.</p>}
            </Card.Body>
          </Card>
          <Card>
            <Card.Body>
              <h2 className="h6"><i className="bi bi-calendar-check me-2 text-verde" />Hoy</h2>
              {consumo.cargando ? <Esqueleto filas={1} /> : cd && (
                <>
                  <div className="d-flex justify-content-between small mb-1"><span>{cd.consumidas_hoy.toLocaleString('es-CL')} kcal consumidas</span><span>{cd.porcentaje} %</span></div>
                  <ProgressBar now={Math.min(100, cd.porcentaje)} variant={cd.porcentaje > 100 ? 'danger' : 'success'} style={{ height: 10 }} aria-label="Consumo de hoy" />
                  <p className="small text-secondary mt-2 mb-0">Te quedan <strong>{cd.restantes.toLocaleString('es-CL')} kcal</strong> · {cd.pedidos_entregados_hoy} pedido(s) entregado(s) hoy.</p>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={8}>
          <Card>
            <Card.Body>
              <h2 className="h5">Mis datos</h2>
              <Form onSubmit={guardar}>
                <Row className="g-3">
                  <Col md={6}><Form.Group controlId="pNombre"><Form.Label>Nombre</Form.Label><Form.Control value={f.nombre} onChange={c('nombre')} /></Form.Group></Col>
                  <Col md={6}><Form.Group controlId="pTel"><Form.Label>Teléfono</Form.Label><Form.Control type="tel" value={f.telefono} onChange={c('telefono')} placeholder="+569 1234 5678" maxLength={16} isInvalid={telMalo} />
                    <Form.Control.Feedback type="invalid">{MENSAJE_TELEFONO}</Form.Control.Feedback></Form.Group></Col>
                  <Col xs={6} md={3}><Form.Group controlId="pPeso"><Form.Label>Peso (kg)</Form.Label><Form.Control inputMode="decimal" value={f.peso} onChange={c('peso')} /></Form.Group></Col>
                  <Col xs={6} md={3}><Form.Group controlId="pAlt"><Form.Label>Altura (m)</Form.Label><Form.Control inputMode="decimal" value={f.altura} onChange={c('altura')} /></Form.Group></Col>
                  <Col xs={6} md={3}><Form.Group controlId="pEdad"><Form.Label>Edad</Form.Label><Form.Control inputMode="numeric" value={f.edad} onChange={c('edad')} /></Form.Group></Col>
                  <Col xs={6} md={3}><Form.Group controlId="pGen"><Form.Label>Género</Form.Label><Form.Select value={f.genero} onChange={c('genero')}><option>Femenino</option><option>Masculino</option><option>Otro</option></Form.Select></Form.Group></Col>
                  <Col md={6}><Form.Group controlId="pAct"><Form.Label>Actividad física</Form.Label>
                    <Form.Select value={f.nivel_actividad} onChange={c('nivel_actividad')}>{Object.entries(ACTIVIDADES).map(([k, [t, d]]) => <option key={k} value={k}>{t} · {d}</option>)}</Form.Select></Form.Group></Col>
                  <Col md={6}><Form.Group controlId="pObj"><Form.Label>Objetivo</Form.Label>
                    <Form.Select value={f.objetivo} onChange={c('objetivo')}>{Object.entries(OBJETIVOS).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</Form.Select></Form.Group></Col>
                </Row>
                {metaNueva && !plan && metaNueva !== pb.meta_calorica_diaria && (
                  <Alert variant="info" className="small mt-3 mb-0 py-2"><i className="bi bi-calculator me-1" />Con estos datos tu meta quedaría en <strong>{metaNueva.toLocaleString('es-CL')} kcal/día</strong> (fórmula de Mifflin-St Jeor).</Alert>
                )}
                <Button type="submit" className="mt-3" disabled={guardarA.enviando || telMalo}>{guardarA.enviando ? <Spinner size="sm" /> : 'Guardar cambios'}</Button>
              </Form>
              <p className="small text-secondary mt-3 mb-0"><i className="bi bi-lock-fill me-1" />Tus datos de salud se guardan cifrados (AES-256) y solo los ves tú.</p>
            </Card.Body>
          </Card>

          <Card className="mt-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <h2 className="h5 mb-0">Planes nutricionales</h2>
                {plan && <Button size="sm" variant="outline-danger" onClick={() => setCancelar(true)}>Cancelar mi plan</Button>}
              </div>
              {planes.cargando ? <Esqueleto filas={1} /> : (
                <Row xs={1} md={3} className="g-2">
                  {(planes.datos || []).map((p) => {
                    const activo = plan && String(plan.plan_id) === String(p._id);
                    return (
                      <Col key={p._id}>
                        <div className={`tarjeta-plan border rounded-4 p-3 h-100 d-flex flex-column ${activo ? 'activo' : ''}`}>
                          {activo && <Badge bg="success" className="align-self-start mb-2"><i className="bi bi-check2 me-1" />Tu plan</Badge>}
                          <div className="fw-bold">{p.nombre_plan}</div>
                          <div className="small text-secondary mb-2">{p.objetivo}</div>
                          <div className="small"><i className="bi bi-fire text-warning me-1" />{p.calorias_diarias.toLocaleString('es-CL')} kcal/día</div>
                          <div className="fs-5 fw-bold my-1">USD {decimal(p.precio_mensual, 2)}<small className="fw-normal text-secondary">/mes</small></div>
                          <div className="d-flex flex-wrap gap-1 mb-3">{p.tags?.map((t) => <Badge key={t} bg="light" text="dark" className="border">{t}</Badge>)}</div>
                          <Button size="sm" className="mt-auto" variant={activo ? 'outline-secondary' : 'primary'} disabled={activo} onClick={() => setContratar(p)}>
                            {activo ? 'Contratado' : plan ? 'Cambiar a este plan' : 'Contratar'}
                          </Button>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Card.Body>
          </Card>
          <Alert variant="danger" className="mt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span><i className="bi bi-shield-x me-1" />Puedes eliminar tu cuenta y tus datos de salud cuando quieras (Ley 21.719).</span>
            <Button variant="outline-danger" size="sm" onClick={() => setBorrar(true)}>Eliminar mis datos</Button>
          </Alert>
        </Col>
      </Row>

      <Modal show={!!contratar} onHide={() => setContratar(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Contratar el plan {contratar?.nombre_plan}?</Modal.Title></Modal.Header>
        <Modal.Body>
          Tu meta diaria pasará a <strong>{contratar?.calorias_diarias.toLocaleString('es-CL')} kcal</strong>. El cargo es de USD {decimal(contratar?.precio_mensual, 2)} al mes y puedes cancelarlo cuando quieras.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setContratar(null)}>Ahora no</Button>
          <Button onClick={() => { setPagarPlan(contratar); setContratar(null); }}>Continuar al pago</Button>
        </Modal.Footer>
      </Modal>
      {/* El monto se muestra en pesos de referencia: USD × 950 */}
      <PasarelaPago show={!!pagarPlan} monto={Math.round((pagarPlan?.precio_mensual || 0) * 950)} concepto={`Plan ${pagarPlan?.nombre_plan || ''} · 1 mes`} alCerrar={() => setPagarPlan(null)} alPagar={pagarYContratar} />

      <Modal show={cancelar} onHide={() => setCancelar(false)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Cancelar el plan {plan?.nombre_plan}?</Modal.Title></Modal.Header>
        <Modal.Body>Tu meta volverá a la recomendada para tu perfil{pb.meta_recomendada ? ` (${pb.meta_recomendada.toLocaleString('es-CL')} kcal)` : ''}.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setCancelar(false)}>Mantener mi plan</Button>
          <Button variant="danger" onClick={cancelarPlan} disabled={planA.enviando}>{planA.enviando ? <Spinner size="sm" /> : 'Cancelar plan'}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={borrar} onHide={() => setBorrar(false)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Eliminar tu cuenta?</Modal.Title></Modal.Header>
        <Modal.Body>Se borrarán tu perfil, tus datos de salud, tus avisos y tu historial de pedidos. No se puede deshacer.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setBorrar(false)}>Cancelar</Button>
          <Button variant="danger" onClick={eliminar} disabled={borrarA.enviando}>{borrarA.enviando ? <Spinner size="sm" /> : 'Sí, eliminar mis datos'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
