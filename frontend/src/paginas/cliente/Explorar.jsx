import { useMemo, useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Col, Form, InputGroup, Modal, ProgressBar, Row, Table, ToggleButton } from 'react-bootstrap';
import { api, clp } from '../../api/cliente';
import { useCarrito } from '../../contexto/Carrito';
import { useAvisos } from '../../contexto/Avisos';
import { useSesion } from '../../contexto/Sesion';
import { useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { ImagenPlatillo, Transparencia } from '../../componentes/Insignias';

const CATEGORIAS = ['todas', 'Desayuno', 'Almuerzo', 'Cena', 'Snack'];
const ORDEN = { transparencia: 'Más transparentes', kcal: 'Menos calorías', precio: 'Menor precio', proteina: 'Más proteína' };

function Macros({ m = {} }) {
  return (
    <div className="d-flex gap-3 small">
      <span><strong>{m.proteinas_g || 0} g</strong> <span className="text-secondary">prot.</span></span>
      <span><strong>{m.carbohidratos_g || 0} g</strong> <span className="text-secondary">carb.</span></span>
      <span><strong>{m.grasas_g || 0} g</strong> <span className="text-secondary">grasa</span></span>
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
  const [ligero, setLigero] = useState(false);
  const [proteico, setProteico] = useState(false);
  const [orden, setOrden] = useState('transparencia');
  const [ficha, setFicha] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [confirmarCambio, setConfirmarCambio] = useState(null);

  // Filtros que resuelve MongoDB en el servidor ($regex, $lte, $gte)
  const filtros = { categoria, busqueda: busqueda.trim(), maxCalorias: ligero ? 600 : '', minProteina: proteico ? 30 : '' };
  const { datos, error, cargando, recargar } = useCarga(() => api.platillos(filtros), [categoria, busqueda, ligero, proteico]);

  const lista = useMemo(() => {
    const l = [...(datos || [])];
    if (orden === 'kcal') l.sort((a, b) => a.calorias - b.calorias);
    if (orden === 'precio') l.sort((a, b) => a.precio - b.precio);
    if (orden === 'proteina') l.sort((a, b) => (b.macronutrientes?.proteinas_g || 0) - (a.macronutrientes?.proteinas_g || 0));
    return l;
  }, [datos, orden]);

  const meta = usuario?.perfil_biometrico?.meta_calorica_diaria || 1800;
  const pct = Math.min(100, Math.round((carrito.kcal / meta) * 100));

  const agregar = (p, n = 1) => {
    if (carrito.esDeOtroLocal(p)) { setConfirmarCambio({ p, n }); return; }
    carrito.agregar(p, n);
    avisar(`Agregaste ${n} × ${p.nombre} al carrito`);
    setFicha(null);
  };

  return (
    <>
      <Card className="bg-verde-claro border-0 mb-3">
        <Card.Body className="py-3">
          <div className="d-flex justify-content-between small mb-1">
            <span><i className="bi bi-fire text-warning me-1" />Tu carrito suma <strong>{carrito.kcal.toLocaleString('es-CL')} kcal</strong></span>
            <span>Meta diaria: <strong>{meta.toLocaleString('es-CL')} kcal</strong></span>
          </div>
          <ProgressBar now={pct} variant={pct > 100 ? 'danger' : 'success'} style={{ height: 8 }} aria-label="Calorías del carrito respecto de tu meta" />
        </Card.Body>
      </Card>

      <h1 className="h3 mb-3">Hola, {usuario?.nombre?.split(' ')[0]} 👋 ¿Qué comemos hoy?</h1>

      <Row className="g-2 mb-3">
        <Col md={6}>
          <InputGroup>
            <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
            <Form.Control placeholder="Buscar platillo (ej. bowl, salmón)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar platillo" />
          </InputGroup>
        </Col>
        <Col md={3}>
          <Form.Select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar por">
            {Object.entries(ORDEN).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Form.Select>
        </Col>
        <Col md={3} className="d-flex gap-2">
          <ToggleButton id="f-ligero" type="checkbox" variant="outline-success" checked={ligero} value="1" onChange={() => setLigero(!ligero)} className="flex-fill">≤ 600 kcal</ToggleButton>
          <ToggleButton id="f-prot" type="checkbox" variant="outline-success" checked={proteico} value="1" onChange={() => setProteico(!proteico)} className="flex-fill">+30 g prot.</ToggleButton>
        </Col>
      </Row>
      <ButtonGroup className="mb-4 flex-wrap" aria-label="Momento del día">
        {CATEGORIAS.map((c) => (
          <ToggleButton key={c} id={`cat-${c}`} type="radio" name="cat" value={c} variant="outline-primary" size="sm" checked={categoria === c} onChange={() => setCategoria(c)}>
            {c === 'todas' ? 'Todas' : c}
          </ToggleButton>
        ))}
      </ButtonGroup>

      {error && <ErrorCarga error={error} alReintentar={recargar} />}
      {cargando && <Esqueleto filas={3} />}
      {!cargando && !error && lista.length === 0 && (
        <Vacio icono="search" titulo="No encontramos platillos con estos filtros" texto="Prueba con otra búsqueda o quita algún filtro.">
          <Button variant="outline-primary" onClick={() => { setBusqueda(''); setLigero(false); setProteico(false); setCategoria('todas'); }}>Quitar filtros</Button>
        </Vacio>
      )}
      <Row xs={1} sm={2} lg={3} className="g-3">
        {lista.map((p) => (
          <Col key={p._id}>
            <Card className="h-100 card-hover overflow-hidden">
              <button type="button" className="btn p-0 border-0 text-start" onClick={() => { setFicha(p); setCantidad(1); }} aria-label={`Ver ficha de ${p.nombre}`}>
                <ImagenPlatillo src={p.imagen_url} alt={p.nombre} />
              </button>
              <Card.Body className="d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <Card.Title as="h2" className="h6 mb-1">{p.nombre}</Card.Title>
                  <Transparencia valor={p.indice_transparencia} />
                </div>
                <small className="text-secondary mb-2"><i className="bi bi-shop me-1" />{p.restaurante_id?.nombre || 'Restaurante'}</small>
                <div className="d-flex gap-2 mb-2">
                  <Badge bg="light" text="dark" className="border"><i className="bi bi-fire text-warning me-1" />{p.calorias} kcal</Badge>
                  <Badge bg="light" text="dark" className="border">{p.categoria}</Badge>
                </div>
                <Macros m={p.macronutrientes} />
                <div className="d-flex justify-content-between align-items-center mt-auto pt-3">
                  <span className="fs-5 fw-bold">{clp(p.precio)}</span>
                  <Button size="sm" onClick={() => agregar(p)} aria-label={`Agregar ${p.nombre} al carrito`}><i className="bi bi-plus-lg me-1" />Agregar</Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

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
                </Col>
                <Col md={7}>
                  <p className="text-secondary">{ficha.descripcion}</p>
                  <p className="small mb-2"><i className="bi bi-shop me-1" />{ficha.restaurante_id?.nombre} · {ficha.restaurante_id?.direccion}</p>
                  <Row className="text-center g-2 mb-3">
                    {[['Calorías', `${ficha.calorias}`, 'kcal'], ['Proteínas', ficha.macronutrientes?.proteinas_g || 0, 'g'], ['Carbohidratos', ficha.macronutrientes?.carbohidratos_g || 0, 'g'], ['Grasas', ficha.macronutrientes?.grasas_g || 0, 'g']].map(([t, v, u]) => (
                      <Col xs={3} key={t}><div className="bg-verde-claro rounded-3 py-2"><div className="fw-bold">{v}<small> {u}</small></div><small className="text-secondary">{t}</small></div></Col>
                    ))}
                  </Row>
                  <h3 className="h6">Ingredientes (sin letra chica)</h3>
                  {ficha.ingredientes?.length ? (
                    <Table size="sm" className="small">
                      <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Cocción</th></tr></thead>
                      <tbody>{ficha.ingredientes.map((i) => <tr key={i.nombre}><td>{i.nombre}</td><td>{i.cantidad_g} g</td><td>{i.metodo_coccion}</td></tr>)}</tbody>
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
                <Button variant="outline-secondary" onClick={() => setCantidad(Math.min(20, cantidad + 1))} aria-label="Agregar uno">+</Button>
              </div>
              <Button size="lg" onClick={() => agregar(ficha, cantidad)}>Agregar · {clp(ficha.precio * cantidad)}</Button>
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
