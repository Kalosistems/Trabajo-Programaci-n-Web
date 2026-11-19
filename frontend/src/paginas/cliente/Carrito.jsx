import { Alert, Button, Card, Col, ListGroup, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { api, clp } from '../../api/cliente';
import { useCarrito } from '../../contexto/Carrito';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useTitulo } from '../../hooks';
import { Vacio } from '../../componentes/Estados';
import { ImagenPlatillo } from '../../componentes/Insignias';

const ENVIO = 1490;

export default function Carrito() {
  useTitulo('Carrito');
  const c = useCarrito();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const { enviando, ejecutar } = useAccion();

  if (!c.items.length) {
    return (
      <Vacio icono="cart3" titulo="Tu carrito está vacío" texto="Explora los platillos y agrega los que te gusten.">
        <Button as={Link} to="/explorar">Explorar platillos</Button>
      </Vacio>
    );
  }

  const pagar = async () => {
    try {
      // El servidor calcula el total con los precios guardados; solo se envían id y cantidad
      const r = await ejecutar(() => api.crearPedido(c.items.map((i) => ({ platillo_id: i.platillo._id, cantidad: i.cantidad }))));
      c.vaciar();
      avisar(r.mensaje);
      navegar('/pedidos', { state: { codigo: r.pedido.codigo_pedido } });
    } catch (e) {
      avisar(e.message, 'error');
    }
  };

  return (
    <Row className="g-4">
      <Col lg={8}>
        <h1 className="h3 mb-1">Tu carrito</h1>
        <p className="text-secondary"><i className="bi bi-shop me-1" />{c.restaurante?.nombre}</p>
        <ListGroup>
          {c.items.map(({ platillo: p, cantidad }) => (
            <ListGroup.Item key={p._id} className="d-flex gap-3 align-items-center py-3">
              <div style={{ width: 84 }} className="flex-shrink-0"><ImagenPlatillo src={p.imagen_url} alt="" className="rounded-3" /></div>
              <div className="flex-grow-1">
                <div className="fw-semibold">{p.nombre}</div>
                <small className="text-secondary">{p.calorias} kcal · {clp(p.precio)} c/u</small>
                <div className="d-flex align-items-center gap-2 mt-2" role="group" aria-label={`Cantidad de ${p.nombre}`}>
                  <Button size="sm" variant="outline-secondary" onClick={() => c.cambiarCantidad(p._id, cantidad - 1)} disabled={cantidad <= 1} aria-label="Quitar uno">−</Button>
                  <span className="fw-bold px-1">{cantidad}</span>
                  <Button size="sm" variant="outline-secondary" onClick={() => c.cambiarCantidad(p._id, cantidad + 1)} aria-label="Agregar uno">+</Button>
                </div>
              </div>
              <div className="text-end">
                <div className="fw-bold">{clp(p.precio * cantidad)}</div>
                <Button size="sm" variant="link" className="text-danger p-0" onClick={() => c.quitar(p._id)}><i className="bi bi-trash me-1" />Quitar</Button>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Col>
      <Col lg={4}>
        <Card className="position-sticky" style={{ top: 80 }}>
          <Card.Body>
            <h2 className="h5">Resumen</h2>
            <div className="d-flex justify-content-between"><span>Subtotal</span><span>{clp(c.subtotal)}</span></div>
            <div className="d-flex justify-content-between"><span>Envío</span><span>{clp(ENVIO)}</span></div>
            <hr />
            <div className="d-flex justify-content-between fs-5 fw-bold mb-2"><span>Total</span><span>{clp(c.subtotal + ENVIO)}</span></div>
            <Alert variant="success" className="small py-2"><i className="bi bi-fire me-1" />Este pedido suma <strong>{c.kcal.toLocaleString('es-CL')} kcal</strong>.</Alert>
            <Button size="lg" className="w-100" onClick={pagar} disabled={enviando}>
              {enviando ? <><Spinner size="sm" className="me-2" />Procesando…</> : <>Ir a pagar · {clp(c.subtotal + ENVIO)}</>}
            </Button>
            <p className="small text-secondary mt-2 mb-0"><i className="bi bi-shield-lock me-1" />Verás tu PIN de entrega cuando el pedido salga del local.</p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
