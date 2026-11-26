import { useState } from 'react';
import { Badge, Button, Card, Form, InputGroup, Table } from 'react-bootstrap';
import { Stock } from '../../componentes/Insignias';
import { Link } from 'react-router-dom';
import { api, clp } from '../../api/cliente';
import { useAvisos } from '../../contexto/Avisos';
import { useSesion } from '../../contexto/Sesion';
import { useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { ImagenPlatillo, Transparencia } from '../../componentes/Insignias';

export default function Platillos() {
  useTitulo('Mis platillos');
  const avisar = useAvisos();
  const { actualizarUsuario } = useSesion();
  const [texto, setTexto] = useState('');
  const [cambiando, setCambiando] = useState(null);
  const [stocks, setStocks] = useState({});

  // Inventario: el local ajusta las porciones disponibles de cada platillo
  const guardarStock = async (p) => {
    const valor = parseInt(stocks[p._id], 10);
    if (!(valor >= 0)) { avisar('Escribe un número de porciones (0 o más).', 'error'); return; }
    setCambiando(p._id);
    try {
      const r = await api.cambiarStock(p._id, valor);
      avisar(r.mensaje);
      setStocks((s) => { const n = { ...s }; delete n[p._id]; return n; });
      await recargar(true);
    } catch (e) { avisar(e.message, 'error'); } finally { setCambiando(null); }
  };
  const { datos, error, cargando, recargar } = useCarga(() => api.misPlatillos(), []);
  const mios = (datos || []).filter((p) => p.nombre.toLowerCase().includes(texto.toLowerCase()));

  const alternar = async (p) => {
    setCambiando(p._id);
    try {
      const r = await api.estadoPlatillo(p._id, !p.activo);
      avisar(`${r.mensaje} Índice del local: ${r.indice_restaurante} %.`);
      actualizarUsuario({ indice_transparencia: r.indice_restaurante });
      await recargar(true);
    } catch (e) { avisar(e.message, 'error'); } finally { setCambiando(null); }
  };

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
            <thead className="table-light"><tr><th>Platillo</th><th>Categoría</th><th>Precio</th><th>Calorías</th><th>Macros (P/C/G)</th><th>Transparencia</th><th style={{ width: 150 }}>Stock</th><th>En el menú</th></tr></thead>
            <tbody>
              {mios.map((p) => (
                <tr key={p._id} className={p.activo ? '' : 'opacity-50'}>
                  <td><div className="d-flex align-items-center gap-2"><div style={{ width: 56 }}><ImagenPlatillo src={p.imagen_url} alt="" className="rounded-2" /></div>
                    <div><span className="fw-semibold">{p.nombre}</span>{!p.activo && <Badge bg="secondary" className="ms-2">Retirado</Badge>}</div></div></td>
                  <td><Badge bg="light" text="dark" className="border">{p.categoria}</Badge></td>
                  <td>{clp(p.precio)}</td>
                  <td className="text-nowrap">{p.calorias} kcal {p.nutricion_calculada && <i className="bi bi-calculator text-verde" title="Calculado por Kalo" aria-label="Calculado por Kalo" />}</td>
                  <td className="small">{p.macronutrientes?.proteinas_g} / {p.macronutrientes?.carbohidratos_g} / {p.macronutrientes?.grasas_g} g</td>
                  <td><Transparencia valor={p.indice_transparencia} /></td>
                  <td>
                    <InputGroup size="sm">
                      <Form.Control type="number" min={0} value={stocks[p._id] ?? p.stock ?? 30} onChange={(e) => setStocks({ ...stocks, [p._id]: e.target.value })} aria-label={`Stock de ${p.nombre}`} />
                      {stocks[p._id] !== undefined && <Button variant="outline-primary" disabled={cambiando === p._id} onClick={() => guardarStock(p)} aria-label="Guardar stock"><i className="bi bi-check-lg" /></Button>}
                    </InputGroup>
                    <div className="mt-1"><Stock valor={p.stock} /></div>
                  </td>
                  <td><Form.Check type="switch" id={`activo-${p._id}`} checked={p.activo} disabled={cambiando === p._id} onChange={() => alternar(p)} aria-label={p.activo ? `Retirar ${p.nombre} del menú` : `Publicar ${p.nombre}`} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
