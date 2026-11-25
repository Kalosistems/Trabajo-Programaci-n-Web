import { Badge, Card, Col, ProgressBar, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api } from '../../api/cliente';
import { useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';

const MEDALLA = ['🥇', '🥈', '🥉'];

// Ranking de locales por Índice de Transparencia (RF-11). El índice combina qué tan completa es la
// información de sus platillos y lo que dicen las evaluaciones de los clientes (RF-14).
export default function Restaurantes() {
  useTitulo('Locales');
  const { datos, error, cargando, recargar } = useCarga(() => api.restaurantes(), []);
  if (error) return <ErrorCarga error={error} alReintentar={recargar} />;

  return (
    <>
      <div className="mb-4">
        <h1 className="h3 mb-1">Locales más transparentes</h1>
        <p className="text-secondary mb-0">Ordenados por su Índice de Transparencia: información completa de sus platillos + evaluaciones de clientes reales.</p>
      </div>
      {cargando ? <Esqueleto filas={3} /> : !datos?.length ? <Vacio icono="shop" titulo="Aún no hay locales" /> : (
        <Row xs={1} md={2} xl={3} className="g-3">
          {datos.map((r, i) => {
            const v = Math.round(r.indice_transparencia || 0);
            return (
              <Col key={r._id}>
                <Card as={Link} to={`/locales/${r._id}`} className="h-100 card-hover text-decoration-none text-body overflow-hidden">
                  <div className="portada-local" style={r.foto_cocina ? { backgroundImage: `url(${r.foto_cocina})` } : undefined}>
                    <span className="posicion">{MEDALLA[i] || `#${i + 1}`}</span>
                    {r.total_fotos_cocina > 0 && <Badge bg="dark" className="bg-opacity-75 position-absolute bottom-0 end-0 m-2"><i className="bi bi-camera me-1" />{r.total_fotos_cocina} fotos de la cocina</Badge>}
                  </div>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h2 className="h5 mb-0">{r.nombre}</h2>
                        <small className="text-secondary">{r.especialidad}</small>
                      </div>
                      <span className="small text-nowrap"><i className="bi bi-star-fill text-warning" /> {Number(r.calificacion_promedio || 5).toFixed(1)}</span>
                    </div>
                    <div className="d-flex justify-content-between small fw-semibold mt-3 mb-1">
                      <span>Índice de Transparencia</span><span>{v} %</span>
                    </div>
                    <ProgressBar now={v} variant={v >= 90 ? 'success' : v >= 70 ? 'warning' : 'danger'} style={{ height: 8 }} aria-label={`Índice ${v} %`} />
                    <div className="d-flex gap-3 small text-secondary mt-3">
                      <span><i className="bi bi-egg-fried me-1" />{r.total_platillos} platillos</span>
                      <span><i className="bi bi-chat-square-heart me-1" />{r.total_evaluaciones || 0} evaluaciones</span>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );
}
