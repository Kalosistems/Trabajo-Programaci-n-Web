import { useState } from 'react';
import { Button, Nav, Navbar, Offcanvas } from 'react-bootstrap';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSesion } from '../contexto/Sesion';

const ENLACES = [
  { a: '/local/pedidos', icono: 'kanban', texto: 'Pedidos entrantes' },
  { a: '/local/platillos', icono: 'egg-fried', texto: 'Mis platillos' },
  { a: '/local/platillos/nuevo', icono: 'plus-circle', texto: 'Crear platillo' },
  { a: '/local/mi-local', icono: 'shop', texto: 'Mi local' },
  { a: '/local/resumen', icono: 'graph-up-arrow', texto: 'Resumen y evaluaciones' },
  { a: '/consultas', icono: 'terminal', texto: 'Consola NoSQL' }
];

function Menu({ alElegir }) {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();
  return (
    <div className="d-flex flex-column h-100 p-3 text-white">
      <span className="logo logo-blanco mb-1">kalo</span>
      <small className="text-white-50 mb-4">{usuario?.nombre}</small>
      <Nav className="flex-column gap-1" as="nav" aria-label="Menú del restaurante">
        {ENLACES.map((e) => (
          <Nav.Link key={e.a} as={NavLink} to={e.a} end onClick={alElegir}>
            <i className={`bi bi-${e.icono} me-2`} aria-hidden="true" />{e.texto}
          </Nav.Link>
        ))}
      </Nav>
      <Button variant="outline-light" size="sm" className="mt-auto" onClick={() => { salir(); navegar('/'); }}>
        <i className="bi bi-box-arrow-right me-2" />Cerrar sesión
      </Button>
    </div>
  );
}

// Restaurante: menú lateral en escritorio (trabaja desde la caja) y menú desplegable en celular
export default function LayoutRestaurante() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="d-flex">
      <aside className="lateral bg-primary d-none d-lg-block flex-shrink-0 position-sticky top-0"><Menu /></aside>
      <div className="flex-grow-1 min-vw-0" style={{ minWidth: 0 }}>
        <Navbar bg="primary" variant="dark" className="d-lg-none px-3">
          <Button variant="link" className="text-white p-0 me-3" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <i className="bi bi-list fs-3" />
          </Button>
          <span className="logo logo-blanco">kalo</span>
        </Navbar>
        <Offcanvas show={abierto} onHide={() => setAbierto(false)} className="bg-primary" style={{ width: 270 }}>
          <Menu alElegir={() => setAbierto(false)} />
        </Offcanvas>
        <main id="contenido" className="p-3 p-md-4"><Outlet /></main>
      </div>
    </div>
  );
}
