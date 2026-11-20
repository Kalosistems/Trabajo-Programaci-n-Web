import { Button, Card, Col, Container, Row } from 'react-bootstrap';
import { Link, Navigate } from 'react-router-dom';
import { useSesion, INICIO_POR_ROL } from '../contexto/Sesion';
import { useTitulo } from '../hooks';

const PILARES = [
  { icono: 'clipboard2-pulse', titulo: 'Sin letra chica', texto: 'Cada platillo muestra calorías, macronutrientes e ingredientes con sus gramos y método de cocción.' },
  { icono: 'patch-check', titulo: 'Índice de Transparencia', texto: 'Los locales que informan mejor y reciben mejores evaluaciones aparecen primero.' },
  { icono: 'shield-lock', titulo: 'Entrega con PIN', texto: 'Tu pedido solo se entrega cuando le dictas al repartidor tu PIN de 4 dígitos.' }
];

export default function Bienvenida() {
  useTitulo('');
  const { rol } = useSesion();
  if (rol) return <Navigate to={INICIO_POR_ROL[rol]} replace />;

  return (
    <main id="contenido">
      <section className="portada py-5">
        <Container className="py-md-5">
          <Row className="align-items-center g-4">
            <Col lg={7}>
              <span className="logo logo-blanco fs-1">kalo</span>
              <h1 className="display-5 fw-800 mt-3">Comida saludable, sin sorpresas.</h1>
              <p className="lead">Pide platillos con su información nutricional completa, sigue tu meta calórica y recibe tu pedido de forma segura.</p>
              <div className="d-flex flex-wrap gap-2 mt-4">
                <Button as={Link} to="/registro" variant="warning" size="lg">Crear cuenta</Button>
                <Button as={Link} to="/entrar" variant="outline-light" size="lg">Iniciar sesión</Button>
              </div>
            </Col>
            <Col lg={5}>
              <Card className="text-body shadow-lg border-0">
                <Card.Body className="p-4">
                  <h2 className="h6 text-secondary mb-3">¿Quién eres?</h2>
                  {[
                    ['bag-heart', 'Comprador', 'Pide comida que calce con tu plan nutricional.'],
                    ['shop', 'Restaurante', 'Publica tus platillos y gestiona tus pedidos.'],
                    ['scooter', 'Repartidor', 'Acepta entregas y valida el PIN en la puerta.']
                  ].map(([i, t, d]) => (
                    <div key={t} className="d-flex gap-3 align-items-start mb-3">
                      <span className="bg-verde-claro text-verde rounded-3 p-2"><i className={`bi bi-${i} fs-4`} aria-hidden="true" /></span>
                      <div><strong>{t}</strong><div className="small text-secondary">{d}</div></div>
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>
      <Container className="py-5">
        <Row className="g-4">
          {PILARES.map((p) => (
            <Col md={4} key={p.titulo}>
              <Card className="h-100 card-hover">
                <Card.Body>
                  <i className={`bi bi-${p.icono} fs-2 text-verde`} aria-hidden="true" />
                  <h2 className="h5 mt-2">{p.titulo}</h2>
                  <p className="text-secondary mb-0">{p.texto}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </main>
  );
}
