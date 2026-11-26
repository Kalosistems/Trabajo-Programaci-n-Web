import { useState } from 'react';
import { Badge, Button, Card, Col, ListGroup, Modal, ProgressBar, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { api, clp, fecha } from '../../api/cliente';
import { useCarrito } from '../../contexto/Carrito';
import { useAvisos } from '../../contexto/Avisos';
import { useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { Estrellas, ImagenPlatillo, Stock, Transparencia } from '../../componentes/Insignias';

// Galería de fotos de la cocina (RF-07). Se reutiliza en "Mi local" del restaurante.
export function Galeria({ fotos, alEliminar }) {
  const [abierta, setAbierta] = useState(null);
  if (!fotos?.length) return <Vacio icono="camera" titulo="Sin fotos de la cocina" texto="Este local todavía no publica fotos de sus instalaciones." />;
  return (
    <>
      <Row xs={2} md={3} className="g-2">
        {fotos.map((f) => (
          <Col key={f._id}>
            <div className="foto-cocina position-relative">
              <button type="button" className="btn p-0 border-0 w-100" onClick={() => setAbierta(f)} aria-label={`Ver foto: ${f.descripcion || f.area}`}>
                <img src={f.url} alt={f.descripcion || `Foto de ${f.area}`} loading="lazy" onError={(e) => { e.currentTarget.src = '/cocina.svg'; }} />
              </button>
              <span className="etiqueta-foto">{f.area}{f.descripcion ? ` · ${f.descripcion}` : ''}</span>
              {alEliminar && (
                <Button size="sm" variant="danger" className="position-absolute top-0 end-0 m-1 py-0 px-1" onClick={() => alEliminar(f)} aria-label="Eliminar foto"><i className="bi bi-trash" /></Button>
              )}
            </div>
          </Col>
        ))}
      </Row>
      <Modal show={!!abierta} onHide={() => setAbierta(null)} centered size="lg">
        <Modal.Header closeButton><Modal.Title as="h2" className="h6">{abierta?.area}{abierta?.descripcion ? ` · ${abierta.descripcion}` : ''}</Modal.Title></Modal.Header>
        <Modal.Body className="p-0"><img src={abierta?.url} alt={abierta?.descripcion || 'Foto de la cocina'} className="w-100" /></Modal.Body>
      </Modal>
    </>
  );
}

export default function PerfilLocal() {
  const { id } = useParams();
  const carrito = useCarrito();
  const avisar = useAvisos();
  const { datos, error, cargando, recargar } = useCarga(() => api.restaurante(id), [id]);
  useTitulo(datos?.restaurante?.nombre || 'Local');

  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;
  if (cargando) return <Esqueleto filas={3} />;
  const { restaurante: r, platillos, fotos, evaluaciones } = datos;
  const v = Math.round(r.indice_transparencia || 0);

  const agregar = (p) => {
    if (p.stock === 0) { avisar(`"${p.nombre}" está agotado.`, 'error'); return; }
    const plato = { ...p, restaurante_id: { _id: r._id, nombre: r.nombre } };
    if (carrito.esDeOtroLocal(plato)) { avisar(`Tu carrito tiene platillos de ${carrito.restaurante?.nombre}. Vacíalo para pedir aquí.`, 'error'); return; }
    carrito.agregar(plato, 1);
    avisar(`Agregaste ${p.nombre} al carrito`);
  };

  return (
    <>
      <Link to="/locales" className="small"><i className="bi bi-arrow-left me-1" />Todos los locales</Link>
      <Card className="border-0 shadow-sm my-3 overflow-hidden">
        <div className="portada-local portada-grande" style={r.foto_cocina ? { backgroundImage: `url(${r.foto_cocina})` } : undefined} />
        <Card.Body>
          <Row className="g-3 align-items-center">
            <Col md={7}>
              <h1 className="h3 mb-0">{r.nombre}</h1>
              <div className="text-secondary">{r.especialidad}</div>
              <div className="small mt-1"><i className="bi bi-geo-alt me-1" />{r.direccion}</div>
            </Col>
            <Col md={5}>
              <div className="d-flex justify-content-between small fw-semibold mb-1"><span><i className="bi bi-patch-check-fill text-success me-1" />Índice de Transparencia</span><span>{v} %</span></div>
              <ProgressBar now={v} variant={v >= 90 ? 'success' : v >= 70 ? 'warning' : 'danger'} style={{ height: 10 }} aria-label={`Índice ${v} %`} />
              <div className="small text-secondary mt-2"><i className="bi bi-star-fill text-warning" /> {Number(r.calificacion_promedio || 5).toFixed(1)} · {r.total_evaluaciones || 0} evaluaciones</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col lg={8}>
          <h2 className="h5">Menú</h2>
          {!platillos.length ? <Vacio icono="egg-fried" titulo="Sin platillos publicados" /> : (
            <Row xs={1} sm={2} className="g-3">
              {platillos.map((p) => (
                <Col key={p._id}>
                  <Card className="h-100 overflow-hidden">
                    <ImagenPlatillo src={p.imagen_url} alt={p.nombre} />
                    <Card.Body className="d-flex flex-column">
                      <div className="d-flex justify-content-between gap-2"><h3 className="h6 mb-1">{p.nombre}</h3><Transparencia valor={p.indice_transparencia} /></div>
                      <div className="small text-secondary mb-2"><i className="bi bi-fire text-warning me-1" />{p.calorias} kcal · {p.macronutrientes?.proteinas_g} g prot. <Stock valor={p.stock} /></div>
                      <div className="d-flex justify-content-between align-items-center mt-auto">
                        <span className="fw-bold">{clp(p.precio)}</span>
                        <Button size="sm" onClick={() => agregar(p)} disabled={p.stock === 0}><i className="bi bi-plus-lg me-1" />{p.stock === 0 ? 'Agotado' : 'Agregar'}</Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Col>
        <Col lg={4}>
          <h2 className="h5"><i className="bi bi-camera me-2" />La cocina por dentro</h2>
          <p className="small text-secondary">Fotos publicadas por el local para que sepas dónde se prepara tu comida.</p>
          <Galeria fotos={fotos} />
          <h2 className="h5 mt-4">Lo que dicen los clientes</h2>
          {!evaluaciones.length ? <p className="small text-secondary">Aún no hay evaluaciones.</p> : (
            <ListGroup variant="flush">
              {evaluaciones.map((e, i) => (
                <ListGroup.Item key={i} className="px-0">
                  <div className="d-flex justify-content-between"><strong className="small">{e.cliente}</strong><Estrellas valor={e.calificacion_general} /></div>
                  {e.comentario && <div className="small">“{e.comentario}”</div>}
                  <div className="d-flex gap-2 mt-1">
                    <Badge bg="light" text="dark" className="border">Foto {e.similitud_foto}/5</Badge>
                    <Badge bg="light" text="dark" className="border">Porción {e.gramaje_porcion}/5</Badge>
                  </div>
                  {e.fecha_evaluacion && <small className="text-secondary">{fecha(e.fecha_evaluacion)}</small>}
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Col>
      </Row>
    </>
  );
}
