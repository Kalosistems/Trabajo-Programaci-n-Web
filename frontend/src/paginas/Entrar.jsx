import { useState } from 'react';
import { Alert, Button, Card, Container, Form, InputGroup, Spinner } from 'react-bootstrap';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/cliente';
import { useSesion, INICIO_POR_ROL } from '../contexto/Sesion';
import { useAccion, useTitulo } from '../hooks';

// Cuentas de prueba que crea "npm run seed" (clave Kalo1234)
const DEMOS = [
  { rol: 'Cliente', correo: 'andrea@mail.com', icono: 'bag-heart' },
  { rol: 'Restaurante', correo: 'contacto@greenbowl.cl', icono: 'shop' },
  { rol: 'Repartidor', correo: 'carlos.reparto@kalo.cl', icono: 'scooter' }
];

export default function Entrar() {
  useTitulo('Iniciar sesión');
  const { rol, entrar, avisoVencida } = useSesion();
  const navegar = useNavigate();
  const desde = useLocation().state?.desde;
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const { enviando, ejecutar } = useAccion();

  if (rol) return <Navigate to={INICIO_POR_ROL[rol]} replace />;

  const iniciar = async (c, p) => {
    setError('');
    try {
      const r = await ejecutar(() => api.login(c, p));
      const s = entrar(r);
      navegar(desde || INICIO_POR_ROL[s.usuario.rol], { replace: true });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <main id="contenido" className="bg-verde-claro min-vh-100 d-flex align-items-center py-4">
      <Container style={{ maxWidth: 440 }}>
        <Link to="/" className="logo d-block text-center mb-3">kalo</Link>
        <Card className="shadow-sm border-0">
          <Card.Body className="p-4">
            <h1 className="h4 mb-1">Iniciar sesión</h1>
            <p className="text-secondary small mb-4">Usa tu correo y contraseña.</p>
            {avisoVencida && <Alert variant="warning" className="small">{avisoVencida}</Alert>}
            {error && <Alert variant="danger" className="small" role="alert"><i className="bi bi-exclamation-circle me-2" />{error}</Alert>}
            <Form onSubmit={(e) => { e.preventDefault(); iniciar(correo, password); }} noValidate>
              <Form.Group className="mb-3" controlId="correo">
                <Form.Label>Correo</Form.Label>
                <Form.Control type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required isInvalid={!!error} />
              </Form.Group>
              <Form.Group className="mb-4" controlId="password">
                <Form.Label>Contraseña</Form.Label>
                <InputGroup>
                  <Form.Control type={ver ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required isInvalid={!!error} />
                  <Button variant="outline-secondary" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    <i className={`bi bi-eye${ver ? '-slash' : ''}`} />
                  </Button>
                </InputGroup>
              </Form.Group>
              <Button type="submit" className="w-100" size="lg" disabled={enviando || !correo || !password}>
                {enviando ? <><Spinner size="sm" className="me-2" />Entrando…</> : 'Entrar'}
              </Button>
            </Form>
            <p className="text-center small mt-3 mb-0">¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link></p>
          </Card.Body>
        </Card>
        <Card className="mt-3 border-0 shadow-sm">
          <Card.Body>
            <p className="small fw-semibold mb-2"><i className="bi bi-lightning-charge-fill text-warning me-1" />Acceso rápido con cuentas de prueba (clave Kalo1234)</p>
            <div className="d-grid gap-2">
              {DEMOS.map((d) => (
                <Button key={d.rol} variant="outline-primary" size="sm" disabled={enviando} onClick={() => iniciar(d.correo, 'Kalo1234')}>
                  <i className={`bi bi-${d.icono} me-2`} />Entrar como {d.rol}
                </Button>
              ))}
            </div>
          </Card.Body>
        </Card>
      </Container>
    </main>
  );
}
