import { useState } from 'react';
import { Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { api, clp } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useTitulo } from '../../hooks';
import { ImagenPlatillo, Transparencia } from '../../componentes/Insignias';

const METODOS = ['Fresco', 'Plancha', 'Horno', 'Hervido', 'Vapor', 'Salteado', 'Frito'];

// Mismo cálculo que el backend (mongoController.calcularIndiceTransparencia): vista previa en vivo
function indice(f) {
  let v = 50;
  if (+f.proteinas > 0) v += 10;
  if (+f.carbos > 0) v += 10;
  if (+f.grasas > 0) v += 10;
  if (+f.peso_porcion > 0) v += 10;
  if (f.alergenos.trim().length > 3) v += 5;
  if (f.ingredientes_limpios) v += 5;
  if (f.ingredientes.some((i) => i.nombre.trim())) v += 10;
  return Math.min(v, 100);
}

export default function NuevoPlatillo() {
  useTitulo('Crear platillo');
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const { enviando, ejecutar } = useAccion();
  const [f, setF] = useState({
    nombre: '', descripcion: '', categoria: 'Almuerzo', precio: '', calorias: '', imagen_url: '',
    proteinas: '', carbos: '', grasas: '', peso_porcion: '', alergenos: '', ingredientes_limpios: false,
    ingredientes: [{ nombre: '', cantidad_g: '', metodo_coccion: 'Fresco' }]
  });
  const [validado, setValidado] = useState(false);
  const c = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const cambiarIng = (i, k, v) => setF({ ...f, ingredientes: f.ingredientes.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const valido = f.nombre.trim() && +f.precio > 0 && +f.calorias > 0;

  const guardar = async (e) => {
    e.preventDefault();
    setValidado(true);
    if (!valido) return;
    try {
      const ingredientes = f.ingredientes.filter((i) => i.nombre.trim()).map((i) => ({ ...i, cantidad_g: +i.cantidad_g || 0 }));
      const r = await ejecutar(() => api.crearPlatillo({ ...f, ingredientes }));
      avisar(r.mensaje);
      navegar('/local/platillos');
    } catch (err) { avisar(err.message, 'error'); }
  };

  return (
    <>
      <h1 className="h3 mb-3">Crear platillo</h1>
      <Row className="g-4">
        <Col xl={8}>
          <Form noValidate onSubmit={guardar}>
            <Card className="mb-3"><Card.Body>
              <h2 className="h6 text-secondary text-uppercase">Información básica</h2>
              <Row className="g-3">
                <Col md={8}><Form.Group controlId="nNombre"><Form.Label>Nombre *</Form.Label><Form.Control value={f.nombre} onChange={c('nombre')} isInvalid={validado && !f.nombre.trim()} />
                  <Form.Control.Feedback type="invalid">Escribe el nombre del platillo.</Form.Control.Feedback></Form.Group></Col>
                <Col md={4}><Form.Group controlId="nCat"><Form.Label>Categoría</Form.Label><Form.Select value={f.categoria} onChange={c('categoria')}>{['Desayuno', 'Almuerzo', 'Cena', 'Snack'].map((x) => <option key={x}>{x}</option>)}</Form.Select></Form.Group></Col>
                <Col md={12}><Form.Group controlId="nDesc"><Form.Label>Descripción</Form.Label><Form.Control as="textarea" rows={2} value={f.descripcion} onChange={c('descripcion')} /></Form.Group></Col>
                <Col md={4}><Form.Group controlId="nPrecio"><Form.Label>Precio *</Form.Label><InputGroup><InputGroup.Text>$</InputGroup.Text><Form.Control inputMode="numeric" value={f.precio} onChange={c('precio')} isInvalid={validado && !(+f.precio > 0)} />
                  <Form.Control.Feedback type="invalid">Debe ser mayor que 0.</Form.Control.Feedback></InputGroup></Form.Group></Col>
                <Col md={4}><Form.Group controlId="nKcal"><Form.Label>Calorías *</Form.Label><InputGroup><Form.Control inputMode="numeric" value={f.calorias} onChange={c('calorias')} isInvalid={validado && !(+f.calorias > 0)} /><InputGroup.Text>kcal</InputGroup.Text>
                  <Form.Control.Feedback type="invalid">Debe ser mayor que 0.</Form.Control.Feedback></InputGroup></Form.Group></Col>
                <Col md={4}><Form.Group controlId="nImg"><Form.Label>URL de la foto</Form.Label><Form.Control type="url" value={f.imagen_url} onChange={c('imagen_url')} placeholder="https://…" /></Form.Group></Col>
              </Row>
            </Card.Body></Card>

            <Card className="mb-3"><Card.Body>
              <h2 className="h6 text-secondary text-uppercase">Nutrición (suma transparencia)</h2>
              <Row className="g-3">
                {[['proteinas', 'Proteínas (g)'], ['carbos', 'Carbohidratos (g)'], ['grasas', 'Grasas (g)'], ['peso_porcion', 'Porción (g)']].map(([k, t]) => (
                  <Col xs={6} md={3} key={k}><Form.Group controlId={`n-${k}`}><Form.Label>{t}</Form.Label><Form.Control inputMode="decimal" value={f[k]} onChange={c(k)} /></Form.Group></Col>
                ))}
                <Col md={8}><Form.Group controlId="nAler"><Form.Label>Alérgenos</Form.Label><Form.Control value={f.alergenos} onChange={c('alergenos')} placeholder="Ej. gluten, frutos secos" /></Form.Group></Col>
                <Col md={4} className="d-flex align-items-end"><Form.Check type="switch" id="nLimpio" label="Sin ultraprocesados" checked={f.ingredientes_limpios} onChange={c('ingredientes_limpios')} /></Col>
              </Row>
            </Card.Body></Card>

            <Card className="mb-3"><Card.Body>
              <div className="d-flex justify-content-between align-items-center">
                <h2 className="h6 text-secondary text-uppercase mb-0">Ingredientes (receta estandarizada)</h2>
                <Button size="sm" variant="outline-primary" disabled={f.ingredientes.length >= 30} onClick={() => setF({ ...f, ingredientes: [...f.ingredientes, { nombre: '', cantidad_g: '', metodo_coccion: 'Fresco' }] })}><i className="bi bi-plus-lg me-1" />Agregar</Button>
              </div>
              <Table size="sm" className="mt-2 align-middle">
                <thead><tr><th>Ingrediente</th><th style={{ width: 120 }}>Gramos</th><th style={{ width: 150 }}>Cocción</th><th style={{ width: 40 }} /></tr></thead>
                <tbody>
                  {f.ingredientes.map((ing, i) => (
                    <tr key={i}>
                      <td><Form.Control size="sm" value={ing.nombre} onChange={(e) => cambiarIng(i, 'nombre', e.target.value)} aria-label={`Ingrediente ${i + 1}`} /></td>
                      <td><Form.Control size="sm" inputMode="numeric" value={ing.cantidad_g} onChange={(e) => cambiarIng(i, 'cantidad_g', e.target.value)} aria-label={`Gramos del ingrediente ${i + 1}`} /></td>
                      <td><Form.Select size="sm" value={ing.metodo_coccion} onChange={(e) => cambiarIng(i, 'metodo_coccion', e.target.value)} aria-label={`Cocción del ingrediente ${i + 1}`}>{METODOS.map((m) => <option key={m}>{m}</option>)}</Form.Select></td>
                      <td><Button size="sm" variant="link" className="text-danger" onClick={() => setF({ ...f, ingredientes: f.ingredientes.filter((_, j) => j !== i) })} aria-label="Quitar ingrediente"><i className="bi bi-x-lg" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body></Card>
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={() => navegar('/local/platillos')}>Cancelar</Button>
              <Button type="submit" size="lg" disabled={enviando}>{enviando ? <><Spinner size="sm" className="me-2" />Guardando…</> : 'Publicar platillo'}</Button>
            </div>
          </Form>
        </Col>
        <Col xl={4}>
          <div className="position-sticky" style={{ top: 16 }}>
            <p className="small fw-semibold text-secondary mb-2">Así se verá en la app</p>
            <Card className="overflow-hidden shadow-sm">
              <ImagenPlatillo src={f.imagen_url} alt="Vista previa" />
              <Card.Body>
                <div className="d-flex justify-content-between gap-2"><h2 className="h6 mb-1">{f.nombre || 'Nombre del platillo'}</h2><Transparencia valor={indice(f)} /></div>
                <small className="text-secondary">{usuario?.nombre}</small>
                <div className="small mt-2"><i className="bi bi-fire text-warning me-1" />{f.calorias || 0} kcal · {f.proteinas || 0} g prot.</div>
                <div className="fs-5 fw-bold mt-2">{clp(f.precio)}</div>
              </Card.Body>
            </Card>
            <Card className="mt-3"><Card.Body><Transparencia valor={indice(f)} grande /><p className="small text-secondary mt-2 mb-0">Sube tu puntaje informando macronutrientes, porción, alérgenos e ingredientes.</p></Card.Body></Card>
          </div>
        </Col>
      </Row>
    </>
  );
}
