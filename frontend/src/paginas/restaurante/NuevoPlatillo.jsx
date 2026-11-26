import { useRef, useState } from 'react';
import { Alert, Button, Card, Col, Form, InputGroup, ListGroup, Row, Spinner, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { api, clp } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useCarga, useTitulo } from '../../hooks';
import { comprimirFoto, MAX_ARCHIVO, TIPOS_FOTO } from '../../utils/imagen';
import { ImagenPlatillo, Transparencia } from '../../componentes/Insignias';
import { calcularIndice, METODOS_COCCION as METODOS } from '../../utils/transparencia';
export default function NuevoPlatillo() {
  useTitulo('Crear platillo');
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const { enviando, ejecutar } = useAccion();
  const [f, setF] = useState({
    nombre: '', descripcion: '', categoria: 'Almuerzo', precio: '', calorias: '', imagen_url: '', stock: '30',
    proteinas: '', carbos: '', grasas: '', peso_porcion: '', alergenos: '', ingredientes_limpios: false,
    ingredientes: [{ nombre: '', cantidad_g: '', unidad: 'g', metodo_coccion: '' }]
  });
  const [validado, setValidado] = useState(false);
  const c = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const cambiarIng = (i, k, v) => setF({ ...f, ingredientes: f.ingredientes.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const valido = f.nombre.trim() && +f.precio > 0 && +f.calorias > 0;
  const { indice, detalle } = calcularIndice(f);
  const alimentos = useCarga(() => api.alimentos(), []);
  const [calculo, setCalculo] = useState(null);
  const [calculando, setCalculando] = useState(false);

  // RF-08: Kalo calcula calorías y macros a partir de la receta
  const calcular = async () => {
    setCalculando(true); setCalculo(null);
    try {
      const ingredientes = f.ingredientes.filter((i) => i.nombre.trim()).map((i) => ({ ...i, cantidad_g: +i.cantidad_g || 0 }));
      const r = await api.calcularNutricion({ ingredientes });
      const n = r.datos;
      setF((prev) => ({ ...prev, calorias: String(n.calorias), proteinas: String(n.proteinas), carbos: String(n.carbos), grasas: String(n.grasas) }));
      setCalculo({ mensaje: r.mensaje, fuente: r.fuente, ...n });
    } catch (err) { avisar(err.message, 'error'); } finally { setCalculando(false); }
  };
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const archivoRef = useRef(null);

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) { avisar('La foto debe ser JPG, PNG o WebP.', 'error'); e.target.value = ''; return; }
    if (archivo.size > MAX_ARCHIVO) { avisar('La foto pesa más de 10 MB. Elige una más liviana.', 'error'); e.target.value = ''; return; }
    setProcesandoFoto(true);
    try {
      let datos = await comprimirFoto(archivo);
      if (datos.length > 650000) datos = await comprimirFoto(archivo, 600, 0.7);
      setF((prev) => ({ ...prev, imagen_url: datos }));
    } catch (err) {
      avisar(err.message, 'error'); e.target.value = '';
    } finally { setProcesandoFoto(false); }
  };

  const quitarFoto = () => {
    setF((prev) => ({ ...prev, imagen_url: '' }));
    if (archivoRef.current) archivoRef.current.value = '';
  };

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
                <Col md={4}><Form.Group controlId="nStock"><Form.Label>Porciones disponibles</Form.Label><Form.Control type="number" min={0} value={f.stock} onChange={c('stock')} />
                  <Form.Text>Se descuentan con cada pedido.</Form.Text></Form.Group></Col>
                <Col md={12}><Form.Group controlId="nImg"><Form.Label>Foto del platillo</Form.Label>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <Form.Control ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={elegirFoto} disabled={procesandoFoto} style={{ maxWidth: 420 }} />
                    {procesandoFoto && <Spinner size="sm" />}
                    {f.imagen_url && !procesandoFoto && <Button size="sm" variant="outline-danger" onClick={quitarFoto}><i className="bi bi-trash me-1" />Quitar foto</Button>}
                  </div>
                  <Form.Text>JPG, PNG o WebP. Se ajusta automáticamente a 800 px. Si no subes una, se usa una imagen por defecto.</Form.Text></Form.Group></Col>
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
                <Button size="sm" variant="outline-primary" disabled={f.ingredientes.length >= 30} onClick={() => setF({ ...f, ingredientes: [...f.ingredientes, { nombre: '', cantidad_g: '', unidad: 'g', metodo_coccion: '' }] })}><i className="bi bi-plus-lg me-1" />Agregar</Button>
              </div>
              <Table size="sm" className="mt-2 align-middle">
                <thead><tr><th>Ingrediente</th><th style={{ width: 170 }}>Cantidad</th><th style={{ width: 150 }}>Cocción</th><th style={{ width: 40 }} /></tr></thead>
                <tbody>
                  {f.ingredientes.map((ing, i) => (
                    <tr key={i}>
                      <td><Form.Control size="sm" list="lista-alimentos" value={ing.nombre} onChange={(e) => cambiarIng(i, 'nombre', e.target.value)} placeholder="Ej. pechuga de pollo" aria-label={`Ingrediente ${i + 1}`} /></td>
                      <td><InputGroup size="sm">
                        <Form.Control inputMode="numeric" value={ing.cantidad_g} onChange={(e) => cambiarIng(i, 'cantidad_g', e.target.value)} aria-label={`Cantidad del ingrediente ${i + 1}`} />
                        <Form.Select value={ing.unidad || 'g'} onChange={(e) => cambiarIng(i, 'unidad', e.target.value)} aria-label={`Unidad del ingrediente ${i + 1}`} style={{ flex: '0 0 72px' }}><option value="g">g</option><option value="ml">ml</option></Form.Select>
                      </InputGroup></td>
                      <td><Form.Select size="sm" value={ing.metodo_coccion} onChange={(e) => cambiarIng(i, 'metodo_coccion', e.target.value)} aria-label={`Cocción del ingrediente ${i + 1}`}><option value="">— Elige —</option>{METODOS.map((m) => <option key={m}>{m}</option>)}</Form.Select></td>
                      <td><Button size="sm" variant="link" className="text-danger" onClick={() => setF({ ...f, ingredientes: f.ingredientes.filter((_, j) => j !== i) })} aria-label="Quitar ingrediente"><i className="bi bi-x-lg" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <datalist id="lista-alimentos">{(alimentos.datos || []).map((a) => <option key={a.nombre} value={a.nombre.charAt(0).toUpperCase() + a.nombre.slice(1)} />)}</datalist>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Button variant="success" size="sm" onClick={calcular} disabled={calculando || !f.ingredientes.some((x) => x.nombre.trim() && +x.cantidad_g > 0)}>
                  {calculando ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-calculator me-1" />}Calcular calorías y macros con los ingredientes
                </Button>
                <small className="text-secondary">Completa los campos de nutrición automáticamente.</small>
              </div>
              {calculo && (
                <Alert variant="success" className="small mt-3 mb-0" dismissible onClose={() => setCalculo(null)}>
                  <strong>{calculo.calorias} kcal</strong> · {calculo.proteinas} g prot. · {calculo.carbos} g carb. · {calculo.grasas} g grasa. {calculo.mensaje}
                  <div className="text-secondary mt-1">{calculo.fuente}</div>
                </Alert>
              )}
            </Card.Body></Card>
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={() => navegar('/local/platillos')}>Cancelar</Button>
              <Button type="submit" size="lg" disabled={enviando || procesandoFoto}>{enviando ? <><Spinner size="sm" className="me-2" />Guardando…</> : 'Publicar platillo'}</Button>
            </div>
          </Form>
        </Col>
        <Col xl={4}>
          <div className="position-sticky" style={{ top: 16 }}>
            <p className="small fw-semibold text-secondary mb-2">Así se verá en la app</p>
            <Card className="overflow-hidden shadow-sm">
              <ImagenPlatillo src={f.imagen_url} alt="Vista previa" />
              <Card.Body>
                <div className="d-flex justify-content-between gap-2"><h2 className="h6 mb-1">{f.nombre || 'Nombre del platillo'}</h2><Transparencia valor={indice} /></div>
                <small className="text-secondary">{usuario?.nombre}</small>
                <div className="small mt-2"><i className="bi bi-fire text-warning me-1" />{f.calorias || 0} kcal · {f.proteinas || 0} g prot.</div>
                <div className="fs-5 fw-bold mt-2">{clp(f.precio)}</div>
              </Card.Body>
            </Card>
            <Card className="mt-3"><Card.Body><Transparencia valor={indice} grande /><ListGroup variant="flush" className="small mt-2">
              {detalle.map((d) => (
                <ListGroup.Item key={d.criterio} className="d-flex justify-content-between px-0 py-1">
                  <span><i className={`bi bi-${d.puntos >= d.max && d.max > 0 ? 'check-circle-fill text-success' : d.puntos < 0 ? 'exclamation-triangle-fill text-danger' : 'circle text-secondary'} me-1`} />{d.criterio}</span>
                  <span className="text-nowrap">{d.puntos}{d.max ? ` / ${d.max}` : ''}</span>
                </ListGroup.Item>
              ))}
            </ListGroup></Card.Body></Card>
          </div>
        </Col>
      </Row>
    </>
  );
}
