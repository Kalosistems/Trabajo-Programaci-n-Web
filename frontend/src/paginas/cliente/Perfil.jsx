import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { api, clp, decimal, telefonoValido, MENSAJE_TELEFONO } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useAvisos } from '../../contexto/Avisos';
import { useCarrito } from '../../contexto/Carrito';
import { useAccion, useCarga, useTitulo } from '../../hooks';
import { Esqueleto } from '../../componentes/Estados';

function estadoImc(imc) {
  if (imc < 18.5) return ['Bajo peso', 'info'];
  if (imc < 25) return ['Peso saludable', 'success'];
  if (imc < 30) return ['Sobrepeso', 'warning'];
  return ['Obesidad', 'danger'];
}

export default function Perfil() {
  useTitulo('Mi perfil');
  const { usuario, actualizarUsuario, salir } = useSesion();
  const { vaciar } = useCarrito();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const pb = usuario?.perfil_biometrico || {};
  const [f, setF] = useState({ nombre: usuario?.nombre || '', telefono: usuario?.telefono || '', peso: pb.peso_kg || '', altura: pb.altura_m || '', edad: pb.edad || '', genero: pb.genero || 'Otro' });
  const [borrar, setBorrar] = useState(false);
  const guardarA = useAccion();
  const borrarA = useAccion();
  const planes = useCarga(() => api.planes(), []);
  const [texto, color] = estadoImc(pb.imc || 0);

  const telMalo = !telefonoValido(f.telefono);

  const guardar = async (e) => {
    e.preventDefault();
    if (telMalo) { avisar(MENSAJE_TELEFONO, 'error'); return; }
    try {
      const r = await guardarA.ejecutar(() => api.actualizarPerfil({ ...f, peso: parseFloat(String(f.peso).replace(',', '.')), altura: parseFloat(String(f.altura).replace(',', '.')) }));
      actualizarUsuario({ nombre: r.usuario.nombre, telefono: r.usuario.telefono, perfil_biometrico: r.usuario.perfil_biometrico });
      avisar(r.pedidos_actualizados ? `Perfil actualizado (también en ${r.pedidos_actualizados} pedidos)` : 'Perfil actualizado');
    } catch (err) { avisar(err.message, 'error'); }
  };

  const eliminar = async () => {
    try {
      await borrarA.ejecutar(() => api.eliminarCuenta(usuario.id));
      vaciar(); salir(); navegar('/');
    } catch (err) { avisar(err.message, 'error'); }
  };

  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <h1 className="h3 mb-3">Mi perfil</h1>
      <Row className="g-3">
        <Col lg={4}>
          <Card className="text-center h-100">
            <Card.Body>
              <div className="bg-verde-claro text-verde rounded-circle d-inline-grid p-3 mb-2" style={{ display: 'inline-grid', width: 72, height: 72, placeItems: 'center' }}>
                <span className="fs-3 fw-bold">{usuario?.nombre?.[0]}</span>
              </div>
              <h2 className="h5 mb-0">{usuario?.nombre}</h2>
              <p className="small text-secondary">{usuario?.correo}</p>
              <div className="display-6 fw-800 text-verde">{decimal(pb.imc)}</div>
              <div className="small text-secondary">IMC</div>
              <Badge bg={color} text={color === 'warning' || color === 'info' ? 'dark' : undefined} className="mt-1">{texto}</Badge>
              <hr />
              <div className="small">Meta calórica diaria</div>
              <div className="fs-4 fw-bold">{(pb.meta_calorica_diaria || 0).toLocaleString('es-CL')} kcal</div>
              <div className="small text-secondary">{pb.objetivo_salud}</div>
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
                </Row>
                <Button type="submit" className="mt-3" disabled={guardarA.enviando || telMalo}>{guardarA.enviando ? <Spinner size="sm" /> : 'Guardar cambios'}</Button>
              </Form>
            </Card.Body>
          </Card>
          <Card className="mt-3">
            <Card.Body>
              <h2 className="h5">Planes nutricionales</h2>
              {planes.cargando ? <Esqueleto filas={1} /> : (
                <Row xs={1} md={3} className="g-2">
                  {(planes.datos || []).map((p) => (
                    <Col key={p._id}>
                      <div className="border rounded-3 p-3 h-100">
                        <div className="fw-bold">{p.nombre_plan}</div>
                        <div className="small text-secondary mb-2">{p.objetivo}</div>
                        <div className="small"><i className="bi bi-fire text-warning me-1" />{p.calorias_diarias} kcal/día</div>
                        <div className="fw-semibold">USD {decimal(p.precio_mensual, 2)}/mes</div>
                        <div className="mt-2 d-flex flex-wrap gap-1">{p.tags?.map((t) => <Badge key={t} bg="light" text="dark" className="border">{t}</Badge>)}</div>
                      </div>
                    </Col>
                  ))}
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

      <Modal show={borrar} onHide={() => setBorrar(false)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Eliminar tu cuenta?</Modal.Title></Modal.Header>
        <Modal.Body>Se borrarán tu perfil, tus datos de salud y tu historial de pedidos. No se puede deshacer.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setBorrar(false)}>Cancelar</Button>
          <Button variant="danger" onClick={eliminar} disabled={borrarA.enviando}>{borrarA.enviando ? <Spinner size="sm" /> : 'Sí, eliminar mis datos'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
