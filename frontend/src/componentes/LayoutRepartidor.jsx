import { Button, Container, Navbar } from 'react-bootstrap';
import { Outlet, useNavigate } from 'react-router-dom';
import { useSesion } from '../contexto/Sesion';
import Campana from './Campana';
import { BotonAccesibilidad } from '../contexto/Accesibilidad';

// Repartidor: pensado para el celular (valida el PIN en la puerta del cliente)
export default function LayoutRepartidor() {
  const { usuario, salir } = useSesion();
  const navegar = useNavigate();
  return (
    <>
      <Navbar bg="primary" variant="dark" sticky="top">
        <Container style={{ maxWidth: 560 }}>
          <span className="logo logo-blanco">kalo</span>
          <div className="d-flex align-items-center gap-2 text-white small">
            <i className="bi bi-scooter fs-5" aria-hidden="true" />
            <span className="d-none d-sm-inline">{usuario?.nombre}</span>
            <BotonAccesibilidad claro />
            <Campana claro />
            <Button size="sm" variant="outline-light" onClick={() => { salir(); navegar('/'); }} aria-label="Cerrar sesión">
              <i className="bi bi-box-arrow-right" />
            </Button>
          </div>
        </Container>
      </Navbar>
      <main id="contenido"><Container className="py-3" style={{ maxWidth: 560 }}><Outlet /></Container></main>
    </>
  );
}
