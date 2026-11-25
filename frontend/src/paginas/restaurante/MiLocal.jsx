import { useRef, useState } from 'react';
import { Button, Card, Col, Form, Modal, ProgressBar, Row, Spinner } from 'react-bootstrap';
import { api, telefonoValido, MENSAJE_TELEFONO } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto } from '../../componentes/Estados';
import { Galeria } from '../cliente/PerfilLocal';
import { prepararFoto } from '../../utils/imagen';

const AREAS = ['Cocina', 'Preparación', 'Almacenamiento', 'Lavado', 'Otra'];

export default function MiLocal() {
  useTitulo('Mi local');
  const { usuario, actualizarUsuario } = useSesion();
  const avisar = useAvisos();
  const { enviando, ejecutar } = useAccion();
  const local = useCarga(() => api.miLocal(), []);
  const [f, setF] = useState({ nombre: usuario?.nombre || '', especialidad: usuario?.especialidad || '', direccion: usuario?.direccion || '', telefono: usuario?.telefono || '' });
  const c = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const telMalo = !telefonoValido(f.telefono);

  // Subida de fotos de la cocina (RF-07)
  const [foto, setFoto] = useState(null); // { imagen, descripcion, area }
  const [procesando, setProcesando] = useState(false);
  const [borrar, setBorrar] = useState(null);
  const archivo = useRef(null);

  const guardar = async (e) => {
    e.preventDefault();
    if (telMalo) { avisar(MENSAJE_TELEFONO, 'error'); return; }
    try {
      const r = await ejecutar(() => api.actualizarLocal(f));
      actualizarUsuario(r.restaurante);
      avisar(r.mensaje);
    } catch (err) { avisar(err.message, 'error'); }
  };

  const elegir = async (e) => {
    const a = e.target.files?.[0];
    e.target.value = '';
    if (!a) return;
    setProcesando(true);
    try { setFoto({ imagen: await prepararFoto(a, 1200), descripcion: '', area: 'Cocina' }); } catch (err) { avisar(err.message, 'error'); } finally { setProcesando(false); }
  };

  const publicar = async () => {
    try {
      const r = await ejecutar(() => api.subirFotoCocina(foto));
      avisar(r.mensaje); setFoto(null); local.recargar(true);
    } catch (err) { avisar(err.message, 'error'); }
  };

  const eliminar = async () => {
    try {
      const r = await ejecutar(() => api.eliminarFotoCocina(borrar._id));
      avisar(r.mensaje); setBorrar(null); local.recargar(true);
    } catch (err) { avisar(err.message, 'error'); }
  };

  if (local.error) return <ErrorCarga error={local.error} alReintentar={local.recargar} />;
  const r = local.datos?.restaurante || usuario || {};
  const v = Math.round(r.indice_transparencia || 0);
  const fotos = local.datos?.fotos || [];
  const max = local.datos?.max_fotos || 12;

  return (
    <>
      <h1 className="h3 mb-3">Mi local</h1>
      <Row className="g-3">
        <Col lg={8}>
          <Card><Card.Body>
            <h2 className="h6 text-secondary text-uppercase">Datos del local</h2>
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

          <Card className="mt-3"><Card.Body>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <div>
                <h2 className="h6 text-secondary text-uppercase mb-0">Fotos de la cocina</h2>
                <small className="text-secondary">Se muestran en tu perfil público. {fotos.length} de {max}.</small>
              </div>
              <Button size="sm" onClick={() => archivo.current?.click()} disabled={procesando || fotos.length >= max}>
                {procesando ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-camera me-1" />}Subir foto
              </Button>
              <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" className="d-none" onChange={elegir} aria-label="Elegir foto de la cocina" />
            </div>
            {local.cargando ? <Esqueleto filas={1} /> : <Galeria fotos={fotos} alEliminar={setBorrar} />}
          </Card.Body></Card>
        </Col>
        <Col lg={4}>
          <Card className="tarjeta-indice border-0 text-white mb-3"><Card.Body>
            <h2 className="h6 opacity-75"><i className="bi bi-patch-check-fill me-1" />Índice de Transparencia del local</h2>
            <div className="display-4 fw-800">{v}<span className="fs-3"> %</span></div>
            <ProgressBar now={v} variant="warning" className="bg-white bg-opacity-25" style={{ height: 8 }} aria-label={`Índice ${v} %`} />
            <p className="small opacity-75 mt-3 mb-0">60 % sale de la información de tus platillos y 40 % de lo que evalúan tus clientes (foto y porción). Los locales con mejor índice aparecen primero en el catálogo.</p>
          </Card.Body></Card>
          <Card className="bg-verde-claro border-0"><Card.Body>
            <h2 className="h6"><i className="bi bi-star-fill text-warning me-1" />Calificación promedio</h2>
            <div className="display-6 fw-800 text-verde">{Number(r.calificacion_promedio || 5).toLocaleString('es-CL', { minimumFractionDigits: 1 })}</div>
            <p className="small text-secondary mb-0">{r.total_evaluaciones || 0} evaluaciones de clientes.</p>
          </Card.Body></Card>
        </Col>
      </Row>

      <Modal show={!!foto} onHide={() => setFoto(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">Publicar foto de la cocina</Modal.Title></Modal.Header>
        <Modal.Body>
          {foto && <img src={foto.imagen} alt="Vista previa" className="w-100 rounded-3 mb-3" />}
          <Row className="g-2">
            <Col xs={5}><Form.Group controlId="fArea"><Form.Label className="small">Área</Form.Label>
              <Form.Select value={foto?.area} onChange={(e) => setFoto({ ...foto, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</Form.Select></Form.Group></Col>
            <Col xs={7}><Form.Group controlId="fDesc"><Form.Label className="small">Descripción</Form.Label>
              <Form.Control maxLength={120} value={foto?.descripcion || ''} onChange={(e) => setFoto({ ...foto, descripcion: e.target.value })} placeholder="Ej. Mesón de ensaladas" /></Form.Group></Col>
          </Row>
          <p className="small text-secondary mt-2 mb-0">La foto se comprimió en tu equipo antes de subirla ({Math.round(((foto?.imagen.length || 0) * 0.75) / 1024)} KB).</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setFoto(null)}>Cancelar</Button>
          <Button onClick={publicar} disabled={enviando}>{enviando ? <Spinner size="sm" /> : 'Publicar foto'}</Button>
        </Modal.Footer>
      </Modal>
      <Modal show={!!borrar} onHide={() => setBorrar(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Eliminar esta foto?</Modal.Title></Modal.Header>
        <Modal.Body>Dejará de verse en tu perfil público.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setBorrar(null)}>Cancelar</Button>
          <Button variant="danger" onClick={eliminar} disabled={enviando}>Eliminar</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
