import { Badge, Button, Card, Col, Container, Row } from 'react-bootstrap';
import { Link, Navigate } from 'react-router-dom';
import { useSesion, INICIO_POR_ROL } from '../contexto/Sesion';
import { useTitulo } from '../hooks';
import { BotonAccesibilidad } from '../contexto/Accesibilidad';

const PILARES = [
  { icono: 'clipboard2-pulse', titulo: 'Sin letra chica', texto: 'Cada platillo muestra calorías, macronutrientes e ingredientes con sus gramos y método de cocción.' },
  { icono: 'patch-check', titulo: 'Índice de Transparencia', texto: 'Los locales que informan mejor y reciben mejores evaluaciones aparecen primero.' },
  { icono: 'camera', titulo: 'Cocinas a la vista', texto: 'Mira fotos reales de dónde se prepara tu comida antes de pedir.' },
  { icono: 'shield-lock', titulo: 'Entrega con PIN', texto: 'Tu pedido solo se entrega cuando le dictas al repartidor tu PIN de 4 dígitos.' }
];

const PASOS = [
  ['person-vcard', 'Crea tu perfil', 'Calculamos tu IMC y tu meta calórica diaria.'],
  ['search-heart', 'Filtra a tu medida', 'Calorías, proteínas, carbohidratos, precio y transparencia.'],
  ['credit-card', 'Paga seguro', 'El pago lo procesa la pasarela: Kalo nunca guarda tu tarjeta.'],
  ['star', 'Recibe y evalúa', 'Valida con tu PIN y cuéntanos si se parecía a la foto.']
];

export default function Bienvenida() {
  useTitulo('');
  const { rol } = useSesion();
  if (rol) return <Navigate to={INICIO_POR_ROL[rol]} replace />;

  return (
    <main id="contenido">
      <section className="portada py-5">
        <Container className="py-md-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <span className="logo logo-blanco fs-1">kalo</span>
            <div className="d-flex gap-2 align-items-center">
              <BotonAccesibilidad claro />
              <Button as={Link} to="/entrar" variant="outline-light" size="sm">Iniciar sesión</Button>
            </div>
          </div>
          <Row className="align-items-center g-5">
            <Col lg={6}>
              <Badge bg="warning" text="dark" className="rounded-pill mb-3 px-3 py-2">🥗 Delivery saludable en Valparaíso y Viña</Badge>
              <h1 className="display-4 fw-800">Comida rápida, saludable y sin sorpresas.</h1>
              <p className="lead">Pide platillos con su información nutricional completa, sigue tu meta calórica y recibe tu pedido de forma segura.</p>
              <div className="d-flex flex-wrap gap-2 mt-4">
                <Button as={Link} to="/registro" variant="warning" size="lg"><i className="bi bi-person-plus me-2" />Crear cuenta gratis</Button>
                <Button as={Link} to="/entrar" variant="outline-light" size="lg">Ya tengo cuenta</Button>
              </div>
              <Row className="mt-4 g-3 text-white">
                {[['100 %', 'ingredientes a la vista'], ['4 dígitos', 'PIN en cada entrega'], ['3 roles', 'cliente, local y repartidor']].map(([n, t]) => (
                  <Col xs={4} key={t}><div className="fs-4 fw-800">{n}</div><div className="small opacity-75">{t}</div></Col>
                ))}
              </Row>
            </Col>
            <Col lg={6} className="position-relative">
              <img className="foto-portada" src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=75" alt="Bowl de salmón y quinoa" onError={(e) => { e.currentTarget.src = '/platillo.svg'; }} />
              <Card className="position-absolute shadow-lg border-0 d-none d-sm-block" style={{ left: -10, bottom: -20, width: 260 }}>
                <Card.Body className="py-2">
                  <div className="d-flex justify-content-between small fw-semibold"><span>Bowl de Salmón y Quinoa</span><span className="text-success">100 %</span></div>
                  <div className="d-flex gap-3 small text-secondary mt-1"><span>520 kcal</span><span>38 g prot.</span><span>45 g carb.</span></div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      <Container className="py-5">
        <h2 className="h3 fw-800 text-center mb-4">Por qué Kalo</h2>
        <Row className="g-4">
          {PILARES.map((p) => (
            <Col md={6} lg={3} key={p.titulo}>
              <Card className="h-100 card-hover border-0 shadow-sm">
                <Card.Body>
                  <span className="bg-verde-claro text-verde rounded-3 p-2 d-inline-block"><i className={`bi bi-${p.icono} fs-3`} aria-hidden="true" /></span>
                  <h3 className="h5 mt-3">{p.titulo}</h3>
                  <p className="text-secondary mb-0">{p.texto}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>

      <section className="bg-white py-5 border-top">
        <Container>
          <h2 className="h3 fw-800 text-center mb-4">Así funciona</h2>
          <Row className="g-4">
            {PASOS.map(([i, t, d], n) => (
              <Col md={3} key={t} className="text-center">
                <div className="cifra mb-2">{n + 1}</div>
                <i className={`bi bi-${i} fs-2 text-verde`} aria-hidden="true" />
                <h3 className="h6 mt-2">{t}</h3>
                <p className="small text-secondary">{d}</p>
              </Col>
            ))}
          </Row>
          <Row className="g-3 mt-2">
            {[['bag-heart', 'Comprador', 'Pide comida que calce con tu plan nutricional.'], ['shop', 'Restaurante', 'Publica tus platillos, muestra tu cocina y gestiona pedidos.'], ['scooter', 'Repartidor', 'Acepta entregas y valida el PIN en la puerta.']].map(([i, t, d]) => (
              <Col md={4} key={t}>
                <Card as={Link} to="/registro" className="h-100 card-hover text-decoration-none text-body">
                  <Card.Body className="d-flex gap-3 align-items-start">
                    <span className="bg-verde-claro text-verde rounded-3 p-2"><i className={`bi bi-${i} fs-4`} aria-hidden="true" /></span>
                    <div><strong>Soy {t.toLowerCase()}</strong><div className="small text-secondary">{d}</div></div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>
      <footer className="text-center small text-secondary py-4">Kalo · NutriDelivery · Grupo 15 · Universidad de Valparaíso</footer>
    </main>
  );
}
