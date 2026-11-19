import { useState } from 'react';
import { Badge, Button, Card, Form, InputGroup, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { api, clp } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { ImagenPlatillo, Transparencia } from '../../componentes/Insignias';

export default function Platillos() {
  useTitulo('Mis platillos');
  const { usuario } = useSesion();
  const [texto, setTexto] = useState('');
  const { datos, error, cargando, recargar } = useCarga(() => api.platillos(), []);
  const mios = (datos || []).filter((p) => p.restaurante_id?._id === usuario?.id)
    .filter((p) => p.nombre.toLowerCase().includes(texto.toLowerCase()));

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h3 mb-0">Mis platillos</h1>
        <Button as={Link} to="/local/platillos/nuevo"><i className="bi bi-plus-lg me-1" />Crear platillo</Button>
      </div>
      <InputGroup className="mb-3" style={{ maxWidth: 360 }}>
        <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
        <Form.Control placeholder="Buscar en mi menú" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar en mi menú" />
      </InputGroup>
      {error && <ErrorCarga error={error} alReintentar={recargar} />}
      {cargando ? <Esqueleto filas={3} /> : !mios.length ? (
        <Vacio icono="egg-fried" titulo="Todavía no tienes platillos publicados" texto="Publica tu primer platillo con sus ingredientes para ganar transparencia.">
          <Button as={Link} to="/local/platillos/nuevo">Crear platillo</Button>
        </Vacio>
      ) : (
        <Card>
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light"><tr><th>Platillo</th><th>Categoría</th><th>Precio</th><th>Calorías</th><th>Macros (P/C/G)</th><th>Transparencia</th></tr></thead>
            <tbody>
              {mios.map((p) => (
                <tr key={p._id}>
                  <td><div className="d-flex align-items-center gap-2"><div style={{ width: 56 }}><ImagenPlatillo src={p.imagen_url} alt="" className="rounded-2" /></div><span className="fw-semibold">{p.nombre}</span></div></td>
                  <td><Badge bg="light" text="dark" className="border">{p.categoria}</Badge></td>
                  <td>{clp(p.precio)}</td>
                  <td>{p.calorias} kcal</td>
                  <td className="small">{p.macronutrientes?.proteinas_g} / {p.macronutrientes?.carbohidratos_g} / {p.macronutrientes?.grasas_g} g</td>
                  <td><Transparencia valor={p.indice_transparencia} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
