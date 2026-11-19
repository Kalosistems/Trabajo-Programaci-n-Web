import { useState } from 'react';
import { Badge, Button, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../api/cliente';
import { useSesion } from '../contexto/Sesion';
import { useTitulo } from '../hooks';

// Consola NoSQL: ejecuta en vivo las consultas de MongoDB que pide la rúbrica (operadores, JOIN y GROUP BY)
const CONSULTAS = [
  { ruta: '/mongo/platillos-con-restaurante', titulo: '$lookup (JOIN)', texto: 'Cada platillo con los datos de su restaurante.', sql: 'SELECT p.*, r.nombre FROM Platillo p INNER JOIN Restaurante r ON p.Id_restaurante = r.Id_restaurante;' },
  { ruta: '/mongo/usuarios-pedidos', titulo: '$lookup + $size (LEFT JOIN)', texto: 'Cada cliente con su cantidad de pedidos, también los que tienen 0.', sql: 'SELECT c.Nombre, COUNT(p.Id_pedido) FROM Cliente c LEFT JOIN Pedido p ON p.Id_cliente = c.Id_cliente GROUP BY c.Id_cliente;', sesion: true },
  { ruta: '/mongo/estadisticas', titulo: '$group (GROUP BY)', texto: 'Cantidad de clientes y promedios de IMC por género.', sql: 'SELECT Genero, COUNT(*), AVG(Peso), AVG(Altura) FROM Cliente GROUP BY Genero;', sesion: true },
  { ruta: '/mongo/platillos-fit?maxCalorias=500', titulo: '$lte', texto: 'Platillos de 500 kcal o menos.', sql: 'SELECT * FROM Platillo WHERE Calorias <= 500 ORDER BY Calorias;' },
  { ruta: '/mongo/planes?precioMin=20', titulo: '$gt + sort()', texto: 'Planes sobre USD 20, del más caro al más barato.', sql: 'SELECT * FROM PlanNutricional WHERE PrecioMensual > 20 ORDER BY PrecioMensual DESC;' },
  { ruta: '/mongo/platillos?busqueda=bowl&minProteina=20', titulo: '$regex + $gte', texto: 'Búsqueda por nombre con mínimo de proteínas.', sql: "SELECT * FROM Platillo WHERE Nombre LIKE '%bowl%' AND Proteinas >= 20;" },
  { ruta: '/mongo/pedidos', titulo: 'find() por rol', texto: 'Pedidos de la sesión (el PIN solo lo ve el cliente).', sql: 'SELECT * FROM Pedido WHERE Id_cliente = ? ORDER BY Fecha DESC;', sesion: true }
];

export default function Consultas() {
  useTitulo('Consola NoSQL');
  const { rol } = useSesion();
  const [elegida, setElegida] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const ejecutar = async (c) => {
    setElegida(c); setCargando(true); setResultado(null);
    setResultado(await api.consulta(c.ruta));
    setCargando(false);
  };

  return (
    <main id="contenido" className="consola">
      <Container className="py-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h1 className="h3 mb-0"><i className="bi bi-terminal text-verde me-2" />Consola de consultas NoSQL</h1>
            <p className="text-secondary mb-0">Consultas en vivo sobre MongoDB Atlas, con su código MQL y su equivalente en SQL.</p>
          </div>
          <Button as={Link} to={rol ? '/' : '/entrar'} variant="outline-primary" size="sm">{rol ? 'Volver a la app' : 'Iniciar sesión'}</Button>
        </div>
        {!rol && <p className="small text-secondary"><i className="bi bi-info-circle me-1" />Las consultas marcadas con <i className="bi bi-lock-fill" /> requieren iniciar sesión (responden 401 sin token).</p>}
        <Row className="g-3">
          <Col lg={4}>
            <div className="d-grid gap-2">
              {CONSULTAS.map((c) => (
                <Button key={c.ruta} variant={elegida === c ? 'primary' : 'outline-primary'} className="text-start" onClick={() => ejecutar(c)}>
                  <div className="fw-bold">{c.titulo} {c.sesion && <i className="bi bi-lock-fill small" aria-label="requiere sesión" />}</div>
                  <div className="small opacity-75">{c.texto}</div>
                </Button>
              ))}
            </div>
          </Col>
          <Col lg={8}>
            <Card>
              <Card.Body>
                {!elegida && <p className="text-secondary mb-0">Elige una consulta para ejecutarla.</p>}
                {elegida && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <code>GET /api{elegida.ruta}</code>
                      {resultado && <Badge bg={resultado.status === 200 ? 'success' : 'danger'}>HTTP {resultado.status}</Badge>}
                    </div>
                    <h2 className="h6 mt-3">Consulta MongoDB (MQL)</h2>
                    <pre>{cargando ? 'Ejecutando…' : resultado?.json?.consultaMQL || '—'}</pre>
                    <h2 className="h6">Equivalente en SQL (Etapa 1)</h2>
                    <pre>{elegida.sql}</pre>
                    <h2 className="h6">Respuesta JSON {resultado?.json?.total !== undefined && <Badge bg="secondary">{resultado.json.total} documentos</Badge>}</h2>
                    {cargando ? <Spinner size="sm" /> : <pre>{JSON.stringify(resultado?.json, null, 2)}</pre>}
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </main>
  );
}
