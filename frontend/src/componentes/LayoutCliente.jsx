import { Badge, Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSesion } from '../contexto/Sesion';
import { useCarrito } from '../contexto/Carrito';
import Campana from './Campana';
import { BotonAccesibilidad } from '../contexto/Accesibilidad';

const ENLACES = [
  { a: '/explorar', icono: 'search', texto: 'Explorar' },
  { a: '/locales', icono: 'shop', texto: 'Locales' },
  { a: '/pedidos', icono: 'bag-check', texto: 'Pedidos' },
  { a: '/carrito', icono: 'cart3', texto: 'Carrito' },
  { a: '/perfil', icono: 'person-circle', texto: 'Mi perfil' }
];

// Cliente: barra superior en escritorio y barra inferior fija en celular (mobile-first, RNF-01)
export default function LayoutCliente() {
  const { usuario, salir } = useSesion();
  const { unidades } = useCarrito();
  const navegar = useNavigate();

  return (
    <div className="con-barra-inferior">
      <Navbar bg="white" expand="md" sticky="top" className="border-bottom">
        <Container>
          <Navbar.Brand as={NavLink} to="/explorar" className="logo">kalo</Navbar.Brand>
          <div className="d-flex d-md-none align-items-center gap-1 ms-auto"><BotonAccesibilidad /><Campana /></div>
          <Nav className="ms-auto d-none d-md-flex align-items-center gap-1">
            {ENLACES.map((e) => (
              <Nav.Link key={e.a} as={NavLink} to={e.a} className="px-3">
                <i className={`bi bi-${e.icono} me-1`} aria-hidden="true" />{e.texto}
                {e.a === '/carrito' && unidades > 0 && <Badge bg="warning" text="dark" pill className="ms-1">{unidades}</Badge>}
              </Nav.Link>
            ))}
            <BotonAccesibilidad />
            <Campana />
            <NavDropdown title={usuario?.nombre?.split(' ')[0] || 'Cuenta'} align="end">
              <NavDropdown.Item onClick={() => { salir(); navegar('/'); }}><i className="bi bi-box-arrow-right me-2" />Cerrar sesión</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Container>
      </Navbar>

      <main id="contenido">
        <Container className="py-3 py-md-4"><Outlet /></Container>
      </main>

      <Nav className="barra-inferior fixed-bottom bg-white border-top d-flex d-md-none justify-content-around" as="nav" aria-label="Menú principal">
        {ENLACES.map((e) => (
          <Nav.Link key={e.a} as={NavLink} to={e.a} className="text-center flex-fill position-relative">
            <i className={`bi bi-${e.icono}`} aria-hidden="true" />{e.texto}
            {e.a === '/carrito' && unidades > 0 && <Badge bg="warning" text="dark" pill className="position-absolute top-0 start-50 ms-2">{unidades}</Badge>}
          </Nav.Link>
        ))}
      </Nav>
    </div>
  );
}
