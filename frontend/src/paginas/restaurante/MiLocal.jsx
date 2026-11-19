import { useState } from 'react';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { api, telefonoValido, MENSAJE_TELEFONO } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useTitulo } from '../../hooks';

export default function MiLocal() {
  useTitulo('Mi local');
  const { usuario, actualizarUsuario } = useSesion();
  const avisar = useAvisos();
  const { enviando, ejecutar } = useAccion();
  const [f, setF] = useState({ nombre: usuario?.nombre || '', especialidad: usuario?.especialidad || '', direccion: usuario?.direccion || '', telefono: usuario?.telefono || '' });
  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const telMalo = !telefonoValido(f.telefono);

  const guardar = async (e) => {
    e.preventDefault();
    if (telMalo) { avisar(MENSAJE_TELEFONO, 'error'); return; }
    try {
      const r = await ejecutar(() => api.actualizarLocal(f));
      const { nombre, especialidad, direccion, telefono } = r.restaurante;
      actualizarUsuario({ nombre, especialidad, direccion, telefono });
      avisar(r.mensaje);
    } catch (err) { avisar(err.message, 'error'); }
  };

  return (
    <>
      <h1 className="h3 mb-3">Mi local</h1>
      <Row className="g-3">
        <Col lg={8}>
          <Card><Card.Body>
            <Form onSubmit={guardar}>
              <Row className="g-3">
                <Col md={6}><Form.Group controlId="lNombre"><Form.Label>Nombre del local</Form.Label><Form.Control value={f.nombre} onChange={c('nombre')} /></Form.Group></Col>
                <Col md={6}><Form.Group controlId="lEsp"><Form.Label>Especialidad</Form.Label><Form.Control value={f.especialidad} onChange={c('especialidad')} /></Form.Group></Col>
                <Col md={8}><Form.Group controlId="lDir"><Form.Label>Dirección</Form.Label><Form.Control value={f.direccion} onChange={c('direccion')} /></Form.Group></Col>
                <Col md={4}><Form.Group controlId="lTel"><Form.Label>Teléfono</Form.Label><Form.Control type="tel" value={f.telefono} onChange={c('telefono')} placeholder="+569 1234 5678" maxLength={16} isInvalid={telMalo} />
                  <Form.Control.Feedback type="invalid">{MENSAJE_TELEFONO}</Form.Control.Feedback></Form.Group></Col>
              </Row>
              <Button type="submit" className="mt-3" disabled={enviando || telMalo}>{enviando ? <Spinner size="sm" /> : 'Guardar cambios'}</Button>
            </Form>
          </Card.Body></Card>
        </Col>
        <Col lg={4}>
          <Card className="bg-verde-claro border-0 h-100"><Card.Body>
            <h2 className="h6"><i className="bi bi-star-fill text-warning me-1" />Calificación promedio</h2>
            <div className="display-6 fw-800 text-verde">{Number(usuario?.calificacion_promedio || 5).toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
            <p className="small text-secondary mb-0">Sale de las evaluaciones de tus clientes y alimenta tu Índice de Transparencia en el catálogo.</p>
          </Card.Body></Card>
        </Col>
      </Row>
    </>
  );
}
