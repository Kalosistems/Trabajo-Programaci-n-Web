import { useMemo, useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Col, Form, InputGroup, Modal, Offcanvas, ProgressBar, Row, Table, ToggleButton } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api, clp } from '../../api/cliente';
import { useCarrito } from '../../contexto/Carrito';
import { useAvisos } from '../../contexto/Avisos';
import { useSesion } from '../../contexto/Sesion';
import { useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { ImagenPlatillo, Stock, Transparencia } from '../../componentes/Insignias';

const CATEGORIAS = ['todas', 'Desayuno', 'Almuerzo', 'Cena', 'Snack'];
const ORDEN = { transparencia: 'Más transparentes', kcal: 'Menos calorías', precio: 'Menor precio', proteina: 'Más proteína' };
const SIN_FILTROS = { maxCalorias: 1200, altoProteina: false, bajoCarbo: false, maxPrecio: 15000, soloTransparentes: false };

function Macros({ m = {} }) {
  return (
    <div className="d-flex gap-3 small">
      <span><strong>{m.proteinas_g || 0} g</strong> <span className="text-secondary">prot.</span></span>
      <span><strong>{m.carbohidratos_g || 0} g</strong> <span className="text-secondary">carb.</span></span>
      <span><strong>{m.grasas_g || 0} g</strong> <span className="text-secondary">grasa</span></span>
    </div>
  );
}

// Filtros avanzados (RF-04): se usan en la barra lateral (escritorio) y en el panel deslizable (celular)
function PanelFiltros({ f, setF, total }) {
  return (
    <div className="d-grid gap-4">
      <Form.Group controlId="fKcal">
        <Form.Label className="d-flex justify-content-between fw-semibold small mb-1">
          <span>Calorías máximas</span><span className="text-verde">{f.maxCalorias >= 1200 ? 'Sin límite' : `${f.maxCalorias} kcal`}</span>
        </Form.Label>
        <Form.Range min={200} max={1200} step={50} value={f.maxCalorias} onChange={(e) => setF({ ...f, maxCalorias: +e.target.value })} />
      </Form.Group>
      <Form.Group controlId="fPrecio">
        <Form.Label className="d-flex justify-content-between fw-semibold small mb-1">
          <span>Presupuesto máximo</span><span className="text-verde">{f.maxPrecio >= 15000 ? 'Sin límite' : clp(f.maxPrecio)}</span>
        </Form.Label>
        <Form.Range min={3000} max={15000} step={500} value={f.maxPrecio} onChange={(e) => setF({ ...f, maxPrecio: +e.target.value })} />
      </Form.Group>
      <div className="d-grid gap-2">
        <span className="fw-semibold small">Nutrición</span>
        <Form.Check type="switch" id="fProt" label="Alto en proteínas (30 g o más)" checked={f.altoProteina} onChange={(e) => setF({ ...f, altoProteina: e.target.checked })} />
        <Form.Check type="switch" id="fCarb" label="Bajo en carbohidratos (30 g o menos)" checked={f.bajoCarbo} onChange={(e) => setF({ ...f, bajoCarbo: e.target.checked })} />
        <Form.Check type="switch" id="fTransp" label="Solo recetas 100 % transparentes" checked={f.soloTransparentes} onChange={(e) => setF({ ...f, soloTransparentes: e.target.checked })} />
      </div>
      <div className="d-flex justify-content-between align-items-center small text-secondary">
        <span>{total} resultado(s)</span>
        <Button size="sm" variant="link" className="p-0" onClick={() => setF(SIN_FILTROS)}>Limpiar filtros</Button>
      </div>
    </div>
  );
}

export default function Explorar() {
  useTitulo('Explorar');
  const { usuario } = useSesion();
  const carrito = useCarrito();
  const avisar = useAvisos();
  const [categoria, setCategoria] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [f, setF] = useState(SIN_FILTROS);
  const [orden, setOrden] = useState('transparencia');
  const [ficha, setFicha] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [confirmarCambio, setConfirmarCambio] = useState(null);
  const [verFiltros, setVerFiltros] = useState(false);

  // Los filtros los resuelve MongoDB en el servidor ($regex, $lte, $gte)
  const filtros = {
    categoria, busqueda: busqueda.trim(),
    maxCalorias: f.maxCalorias < 1200 ? f.maxCalorias : '',
    maxPrecio: f.maxPrecio < 15000 ? f.maxPrecio : '',
    minProteina: f.altoProteina ? 30 : '',
    maxCarbohidratos: f.bajoCarbo ? 30 : '',
    minTransparencia: f.soloTransparentes ? 100 : ''
  };
  const { datos, error, cargando, recargar } = useCarga(() => api.platillos(filtros), [categoria, busqueda, JSON.stringify(f)]);
  const consumo = useCarga(() => api.consumo(), [], { cadaMs: 30000 });

  const lista = useMemo(() => {
    const l = [...(datos || [])];
    if (orden === 'kcal') l.sort((a, b) => a.calorias - b.calorias);
    if (orden === 'precio') l.sort((a, b) => a.precio - b.precio);
    if (orden === 'proteina') l.sort((a, b) => (b.macronutrientes?.proteinas_g || 0) - (a.macronutrientes?.proteinas_g || 0));
    return l;
  }, [datos, orden]);

  const filtrosActivos = [f.maxCalorias < 1200, f.maxPrecio < 15000, f.altoProteina, f.bajoCarbo, f.soloTransparentes].filter(Boolean).length;

  // RF-03: consumo de hoy + lo que suma el carrito frente a la meta diaria
  const meta = consumo.datos?.meta_calorica_diaria || usuario?.perfil_biometrico?.meta_calorica_diaria || 2000;
  const comidas = consumo.datos?.consumidas_hoy || 0;
  const enCamino = consumo.datos?.en_camino_kcal || 0;
  const pct = (n) => Math.min(100, (n / meta) * 100);
  const totalDia = comidas + enCamino + carrito.kcal;

  const agregar = (p, n = 1) => {
    if (p.stock === 0) { avisar(`"${p.nombre}" está agotado.`, 'error'); return; }
    if (p.stock !== undefined && n > p.stock) { avisar(`Solo quedan ${p.stock} porciones de "${p.nombre}".`, 'error'); return; }
    if (carrito.esDeOtroLocal(p)) { setConfirmarCambio({ p, n }); return; }
    carrito.agregar(p, n);
    avisar(`Agregaste ${n} × ${p.nombre} al carrito`);
    setFicha(null);
  };

  return (
    <>
      <Card className="tarjeta-meta border-0 mb-4 text-white overflow-hidden">
        <Card.Body className="p-3 p-md-4">
          <Row className="align-items-center g-3">
            <Col md={7}>
              <h1 className="h3 fw-800 mb-1">Hola, {usuario?.nombre?.split(' ')[0]} 👋</h1>
              <p className="mb-0 opacity-75">¿Qué comemos hoy? Todo con calorías e ingredientes a la vista.</p>
            </Col>
            <Col md={5}>
              <div className="d-flex justify-content-between small mb-1">
                <span>Has consumido <strong>{comidas.toLocaleString('es-CL')}</strong> de {meta.toLocaleString('es-CL')} kcal hoy</span>
              </div>
              <ProgressBar style={{ height: 12 }} className="bg-white bg-opacity-25" aria-label="Calorías del día respecto de tu meta">
                <ProgressBar now={pct(comidas)} variant="light" key="1" />
                <ProgressBar now={pct(enCamino)} variant="info" key="2" />
                <ProgressBar now={pct(carrito.kcal)} variant="warning" key="3" />
              </ProgressBar>
              <div className="d-flex flex-wrap gap-3 small mt-2 opacity-90">
                <span><i className="bi bi-square-fill text-white me-1" />Comido</span>
                {enCamino > 0 && <span><i className="bi bi-square-fill text-info me-1" />Por llegar {enCamino} kcal</span>}
                <span><i className="bi bi-square-fill text-warning me-1" />Carrito {carrito.kcal} kcal</span>
                {totalDia > meta && <span className="fw-bold">⚠️ Superas tu meta</span>}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col lg={3} className="d-none d-lg-block">
          <Card className="position-sticky" style={{ top: 80 }}>
            <Card.Body>
              <h2 className="h6 fw-bold mb-3"><i className="bi bi-sliders me-2" />Filtros a tu medida</h2>
              <PanelFiltros f={f} setF={setF} total={lista.length} />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={9}>
          <Row className="g-2 mb-3">
            <Col xs={12} md={7}>
              <InputGroup>
                <InputGroup.Text className="bg-white"><i className="bi bi-search" /></InputGroup.Text>
                <Form.Control placeholder="Buscar platillo (ej. bowl, salmón)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar platillo" />
              </InputGroup>
            </Col>
            <Col xs={8} md={5} className="d-flex gap-2">
              <Form.Select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar por">
                {Object.entries(ORDEN).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </Form.Select>
              <Button variant="outline-primary" className="d-lg-none text-nowrap" onClick={() => setVerFiltros(true)}>
                <i className="bi bi-sliders me-1" />Filtros{filtrosActivos > 0 && <Badge bg="warning" text="dark" className="ms-1">{filtrosActivos}</Badge>}
              </Button>
            </Col>
          </Row>
          <div className="chips mb-4" role="group" aria-label="Momento del día">
            {CATEGORIAS.map((c) => (
              <ToggleButton key={c} id={`cat-${c}`} type="radio" name="cat" value={c} variant="outline-primary" size="sm" className="rounded-pill px-3" checked={categoria === c} onChange={() => setCategoria(c)}>
                {c === 'todas' ? 'Todas' : c}
              </ToggleButton>
            ))}
          </div>

          {error && <ErrorCarga error={error} alReintentar={recargar} />}
          {cargando && <Esqueleto filas={3} />}
          {!cargando && !error && lista.length === 0 && (
            <Vacio icono="search" titulo="No encontramos platillos con estos filtros" texto="Prueba con otra búsqueda o quita algún filtro.">
              <Button variant="outline-primary" onClick={() => { setBusqueda(''); setF(SIN_FILTROS); setCategoria('todas'); }}>Quitar filtros</Button>
            </Vacio>
          )}
          <Row xs={1} sm={2} xl={3} className="g-3">
            {!cargando && lista.map((p) => (
              <Col key={p._id}>
                <Card className="h-100 card-hover overflow-hidden tarjeta-platillo">
                  <button type="button" className="btn p-0 border-0 text-start position-relative" onClick={() => { setFicha(p); setCantidad(1); }} aria-label={`Ver ficha de ${p.nombre}`}>
                    <ImagenPlatillo src={p.imagen_url} alt={p.nombre} />
                    {p.indice_transparencia === 100 && <span className="sello-100"><i className="bi bi-patch-check-fill me-1" />100 % transparente</span>}
                    {p.stock === 0 && <span className="velo-agotado">Agotado</span>}
                  </button>
                  <Card.Body className="d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <Card.Title as="h2" className="h6 mb-1">{p.nombre}</Card.Title>
                      <Transparencia valor={p.indice_transparencia} />
                    </div>
                    <Link to={`/locales/${p.restaurante_id?._id}`} className="small text-secondary mb-2 text-decoration-none">
                      <i className="bi bi-shop me-1" />{p.restaurante_id?.nombre || 'Restaurante'}
                      {p.restaurante_id?.calificacion_promedio && <span className="ms-1"><i className="bi bi-star-fill text-warning" /> {Number(p.restaurante_id.calificacion_promedio).toFixed(1)}</span>}
                    </Link>
                    <div className="d-flex gap-2 mb-2">
                      <Badge bg="light" text="dark" className="border"><i className="bi bi-fire text-warning me-1" />{p.calorias} kcal</Badge>
                      <Badge bg="light" text="dark" className="border">{p.categoria}</Badge>
                      <Stock valor={p.stock} />
                    </div>
                    <Macros m={p.macronutrientes} />
                    <div className="d-flex justify-content-between align-items-center mt-auto pt-3">
                      <span className="fs-5 fw-bold">{clp(p.precio)}</span>
                      <Button size="sm" onClick={() => agregar(p)} disabled={p.stock === 0} aria-label={`Agregar ${p.nombre} al carrito`}><i className="bi bi-plus-lg me-1" />{p.stock === 0 ? 'Agotado' : 'Agregar'}</Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

      <Offcanvas show={verFiltros} onHide={() => setVerFiltros(false)} placement="bottom" className="h-auto rounded-top-4">
        <Offcanvas.Header closeButton><Offcanvas.Title as="h2" className="h5">A tu medida</Offcanvas.Title></Offcanvas.Header>
        <Offcanvas.Body>
          <PanelFiltros f={f} setF={setF} total={lista.length} />
          <Button className="w-100 mt-3" size="lg" onClick={() => setVerFiltros(false)}>Ver {lista.length} resultado(s)</Button>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Ficha del platillo: desglose completo (RF-05) */}
      <Modal show={!!ficha} onHide={() => setFicha(null)} size="lg" centered scrollable>
        {ficha && (
          <>
            <Modal.Header closeButton><Modal.Title as="h2" className="h5">{ficha.nombre}</Modal.Title></Modal.Header>
            <Modal.Body>
              <Row className="g-4">
                <Col md={5}>
                  <ImagenPlatillo src={ficha.imagen_url} alt={ficha.nombre} className="rounded-3 mb-3" />
                  <Transparencia valor={ficha.indice_transparencia} grande />
                  {ficha.nutricion_calculada && <p className="small text-secondary mt-2 mb-0"><i className="bi bi-calculator me-1" />Nutrición calculada por Kalo a partir de los ingredientes.</p>}
                  {ficha.ingredientes_limpios && <Badge bg="success" className="mt-2"><i className="bi bi-leaf me-1" />Sin ultraprocesados</Badge>}
                </Col>
                <Col md={7}>
                  <p className="text-secondary">{ficha.descripcion}</p>
                  <p className="small mb-2"><Link to={`/locales/${ficha.restaurante_id?._id}`}><i className="bi bi-shop me-1" />{ficha.restaurante_id?.nombre}</Link> · {ficha.restaurante_id?.direccion}</p>
                  <Row className="text-center g-2 mb-3">
                    {[['Calorías', `${ficha.calorias}`, 'kcal'], ['Proteínas', ficha.macronutrientes?.proteinas_g || 0, 'g'], ['Carbohidratos', ficha.macronutrientes?.carbohidratos_g || 0, 'g'], ['Grasas', ficha.macronutrientes?.grasas_g || 0, 'g']].map(([t, v, u]) => (
                      <Col xs={3} key={t}><div className="bg-verde-claro rounded-3 py-2"><div className="fw-bold">{v}<small> {u}</small></div><small className="text-secondary">{t}</small></div></Col>
                    ))}
                  </Row>
                  <p className="small mb-3"><i className="bi bi-bullseye me-1 text-verde" />Este platillo es el <strong>{Math.round((ficha.calorias / meta) * 100)} %</strong> de tu meta diaria.</p>
                  <h3 className="h6">Ingredientes (sin letra chica)</h3>
                  {ficha.ingredientes?.length ? (
                    <Table size="sm" className="small">
                      <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Cocción</th></tr></thead>
                      <tbody>{ficha.ingredientes.map((i) => <tr key={i.nombre}><td>{i.nombre}</td><td>{i.cantidad_g ? `${i.cantidad_g} ${i.unidad || 'g'}` : '—'}</td><td>{i.metodo_coccion}</td></tr>)}</tbody>
                    </Table>
                  ) : <p className="small text-secondary">El restaurante aún no detalla los ingredientes.</p>}
                  <p className="small mb-0"><strong>Porción:</strong> {ficha.peso_porcion_g ? `${ficha.peso_porcion_g} g` : 'no informada'} · <strong>Alérgenos:</strong> {ficha.alergenos || 'no declarados'}</p>
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer className="justify-content-between">
              <div className="d-flex align-items-center gap-2" role="group" aria-label="Cantidad">
                <Button variant="outline-secondary" onClick={() => setCantidad(Math.max(1, cantidad - 1))} aria-label="Quitar uno">−</Button>
                <span className="fw-bold fs-5 px-2" aria-live="polite">{cantidad}</span>
                <Button variant="outline-secondary" onClick={() => setCantidad(Math.min(20, ficha.stock ?? 20, cantidad + 1))} aria-label="Agregar uno">+</Button>
                <Stock valor={ficha.stock} />
              </div>
              <Button size="lg" onClick={() => agregar(ficha, cantidad)} disabled={ficha.stock === 0}>{ficha.stock === 0 ? 'Agotado' : <>Agregar · {clp(ficha.precio * cantidad)}</>}</Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* Un pedido es de un solo local: confirmar antes de vaciar el carrito */}
      <Modal show={!!confirmarCambio} onHide={() => setConfirmarCambio(null)} centered>
        <Modal.Header closeButton><Modal.Title as="h2" className="h5">¿Cambiar de restaurante?</Modal.Title></Modal.Header>
        <Modal.Body>Tu carrito tiene platillos de <strong>{carrito.restaurante?.nombre}</strong>. Un pedido solo puede ser de un local: si continúas, se vaciará el carrito.</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setConfirmarCambio(null)}>Mantener mi carrito</Button>
          <Button variant="danger" onClick={() => { carrito.vaciar(); carrito.agregar(confirmarCambio.p, confirmarCambio.n); avisar(`Carrito nuevo con ${confirmarCambio.p.nombre}`); setConfirmarCambio(null); setFicha(null); }}>Vaciar y agregar</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
