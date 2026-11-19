import { useState } from 'react';
import { Alert, Button, ButtonGroup, Card, Col, Container, Form, ProgressBar, Row, Spinner, ToggleButton } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { api, decimal } from '../api/cliente';
import { useSesion, INICIO_POR_ROL } from '../contexto/Sesion';
import { useAccion, useTitulo } from '../hooks';

const ROLES = [['cliente', 'Comprador', 'bag-heart'], ['restaurante', 'Restaurante', 'shop'], ['repartidor', 'Repartidor', 'scooter']];
const REGLAS = [
  ['Al menos 8 caracteres', (p) => p.length >= 8],
  ['Una mayúscula', (p) => /[A-Z]/.test(p)],
  ['Un número', (p) => /\d/.test(p)]
];

function diagnosticoImc(imc) {
  if (imc < 18.5) return ['Bajo peso', 'info'];
  if (imc < 25) return ['Peso saludable', 'success'];
  if (imc < 30) return ['Sobrepeso', 'warning'];
  return ['Obesidad', 'danger'];
}

// Registro en 2 pasos: cuenta (rol, nombre, correo y clave) y datos del rol (perfil biométrico, local o vehículo)
export default function Registro() {
  useTitulo('Crear cuenta');
  const { entrar } = useSesion();
  const navegar = useNavigate();
  const { enviando, ejecutar } = useAccion();
  const [paso, setPaso] = useState(1);
  const [error, setError] = useState('');
  const [d, setD] = useState({
    rol: 'cliente', nombre: '', correo: '', password: '',
    peso: '', altura: '', edad: '', genero: 'Femenino',
    especialidad: '', direccion: '', telefono: '', vehiculo: 'Motocicleta'
  });
  const cambiar = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const claveOk = REGLAS.every(([, f]) => f(d.password));
  const paso1Ok = d.nombre.trim() && /\S+@\S+\.\S+/.test(d.correo) && claveOk;
  const altura = parseFloat(String(d.altura).replace(',', '.'));
  const peso = parseFloat(String(d.peso).replace(',', '.'));
  const imc = peso > 0 && altura >= 1 && altura <= 2.5 ? peso / (altura * altura) : null;
  const alturaMala = d.altura !== '' && !(altura >= 1 && altura <= 2.5);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const r = await ejecutar(() => api.registro({ ...d, peso, altura, edad: parseInt(d.edad, 10) }));
      const s = entrar(r);
      navegar(INICIO_POR_ROL[s.usuario.rol], { replace: true });
    } catch (err) {
      setError(err.message);
      if (['CORREO_REGISTRADO', 'CLAVE_DEBIL', 'CORREO_INVALIDO'].includes(err.codigo)) setPaso(1);
    }
  };

  return (
    <main id="contenido" className="bg-verde-claro min-vh-100 py-4">
      <Container style={{ maxWidth: 560 }}>
        <Link to="/" className="logo d-block text-center mb-3">kalo</Link>
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h1 className="h4 mb-0">Crear cuenta</h1>
              <small className="text-secondary">Paso {paso} de 2</small>
            </div>
            <ProgressBar now={paso * 50} className="mb-4" style={{ height: 6 }} aria-label={`Paso ${paso} de 2`} />
            {error && <Alert variant="danger" className="small">{error}</Alert>}

            <Form onSubmit={paso === 1 ? (e) => { e.preventDefault(); if (paso1Ok) setPaso(2); } : enviar} noValidate>
              {paso === 1 && (
                <>
                  <Form.Label className="fw-semibold">¿Cómo usarás Kalo?</Form.Label>
                  <ButtonGroup className="w-100 mb-3">
                    {ROLES.map(([v, t, i]) => (
                      <ToggleButton key={v} id={`rol-${v}`} type="radio" name="rol" value={v} variant="outline-primary"
                        checked={d.rol === v} onChange={cambiar('rol')}>
                        <i className={`bi bi-${i} d-block fs-4`} />{t}
                      </ToggleButton>
                    ))}
                  </ButtonGroup>
                  <Form.Group className="mb-3" controlId="nombre">
                    <Form.Label>{d.rol === 'restaurante' ? 'Nombre del local' : 'Nombre completo'}</Form.Label>
                    <Form.Control value={d.nombre} onChange={cambiar('nombre')} autoComplete="name" required />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="correoR">
                    <Form.Label>Correo</Form.Label>
                    <Form.Control type="email" value={d.correo} onChange={cambiar('correo')} autoComplete="email" required />
                  </Form.Group>
                  <Form.Group className="mb-2" controlId="clave">
                    <Form.Label>Contraseña</Form.Label>
                    <Form.Control type="password" value={d.password} onChange={cambiar('password')} autoComplete="new-password" aria-describedby="reglas" />
                  </Form.Group>
                  <ul id="reglas" className="list-unstyled small mb-4">
                    {REGLAS.map(([t, f]) => (
                      <li key={t} className={f(d.password) ? 'text-success' : 'text-secondary'}>
                        <i className={`bi bi-${f(d.password) ? 'check-circle-fill' : 'circle'} me-1`} aria-hidden="true" />{t}
                      </li>
                    ))}
                  </ul>
                  <Button type="submit" className="w-100" size="lg" disabled={!paso1Ok}>Continuar</Button>
                </>
              )}

              {paso === 2 && d.rol === 'cliente' && (
                <>
                  <p className="text-secondary small">Con estos datos calculamos tu IMC y tu meta calórica. Son datos de salud: solo los ves tú y puedes borrarlos cuando quieras (Ley 21.719).</p>
                  <Row className="g-3 mb-3">
                    <Col xs={6}><Form.Group controlId="peso"><Form.Label>Peso (kg)</Form.Label><Form.Control inputMode="decimal" value={d.peso} onChange={cambiar('peso')} placeholder="68,5" /></Form.Group></Col>
                    <Col xs={6}><Form.Group controlId="altura"><Form.Label>Altura (m)</Form.Label><Form.Control inputMode="decimal" value={d.altura} onChange={cambiar('altura')} placeholder="1,65" isInvalid={alturaMala} />
                      <Form.Control.Feedback type="invalid">Entre 1,00 y 2,50 m</Form.Control.Feedback></Form.Group></Col>
                    <Col xs={6}><Form.Group controlId="edad"><Form.Label>Edad</Form.Label><Form.Control inputMode="numeric" value={d.edad} onChange={cambiar('edad')} placeholder="28" /></Form.Group></Col>
                    <Col xs={6}><Form.Group controlId="genero"><Form.Label>Género</Form.Label>
                      <Form.Select value={d.genero} onChange={cambiar('genero')}><option>Femenino</option><option>Masculino</option><option>Otro</option></Form.Select></Form.Group></Col>
                  </Row>
                  {imc && (() => {
                    const [t, c] = diagnosticoImc(imc);
                    return <Alert variant={c} className="d-flex justify-content-between"><span>Tu IMC: <strong>{decimal(imc)}</strong></span><span>{t}</span></Alert>;
                  })()}
                </>
              )}
              {paso === 2 && d.rol === 'restaurante' && (
                <>
                  <Form.Group className="mb-3" controlId="esp"><Form.Label>Especialidad</Form.Label><Form.Control value={d.especialidad} onChange={cambiar('especialidad')} placeholder="Bowls y ensaladas funcionales" /></Form.Group>
                  <Form.Group className="mb-3" controlId="dir"><Form.Label>Dirección</Form.Label><Form.Control value={d.direccion} onChange={cambiar('direccion')} autoComplete="street-address" /></Form.Group>
                  <Form.Group className="mb-3" controlId="telR"><Form.Label>Teléfono</Form.Label><Form.Control type="tel" value={d.telefono} onChange={cambiar('telefono')} /></Form.Group>
                </>
              )}
              {paso === 2 && d.rol === 'repartidor' && (
                <>
                  <Form.Group className="mb-3" controlId="telD"><Form.Label>Teléfono de contacto</Form.Label><Form.Control type="tel" value={d.telefono} onChange={cambiar('telefono')} placeholder="+569…" /></Form.Group>
                  <Form.Group className="mb-3" controlId="veh"><Form.Label>Vehículo</Form.Label>
                    <Form.Select value={d.vehiculo} onChange={cambiar('vehiculo')}><option>Bicicleta</option><option>Motocicleta</option><option>Automóvil</option></Form.Select></Form.Group>
                </>
              )}
              {paso === 2 && (
                <div className="d-flex gap-2 mt-4">
                  <Button variant="outline-secondary" onClick={() => setPaso(1)}>Atrás</Button>
                  <Button type="submit" className="flex-grow-1" disabled={enviando}>
                    {enviando ? <><Spinner size="sm" className="me-2" />Creando…</> : 'Crear mi cuenta'}
                  </Button>
                </div>
              )}
            </Form>
            <p className="text-center small mt-3 mb-0">¿Ya tienes cuenta? <Link to="/entrar">Inicia sesión</Link></p>
          </Card.Body>
        </Card>
      </Container>
    </main>
  );
}
