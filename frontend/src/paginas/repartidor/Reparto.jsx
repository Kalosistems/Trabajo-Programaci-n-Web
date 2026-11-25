import { useState } from 'react';
import { Alert, Badge, Button, Card, Form, Nav, Spinner } from 'react-bootstrap';
import { api, clp, fecha } from '../../api/cliente';
import { useSesion } from '../../contexto/Sesion';
import { useAvisos } from '../../contexto/Avisos';
import { useAccion, useCarga, useTitulo } from '../../hooks';
import { ErrorCarga, Esqueleto, Vacio } from '../../componentes/Estados';
import { EstadoPedido } from '../../componentes/Insignias';

// Teclado grande para validar el PIN en la puerta del cliente (RF-17, RF-18)
function ValidarPin({ pedido, alTerminar }) {
  const avisar = useAvisos();
  const { enviando, ejecutar } = useAccion();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const tocar = (d) => { setError(''); setPin((p) => (p.length < 4 ? p + d : p)); };
  const [avisado, setAvisado] = useState(!!pedido.aviso_cercano_en);

  // RF-23: avisa al cliente que el repartidor llega en 5 minutos o menos (sin mostrar el PIN)
  const avisarCerca = async () => {
    try {
      const r = await ejecutar(() => api.avisarCerca(pedido.codigo_pedido));
      setAvisado(true); avisar(r.mensaje);
    } catch (e) { avisar(e.message, 'error'); }
  };

  const validar = async () => {
    try {
      const r = await ejecutar(() => api.validarPin(pedido.codigo_pedido, pin));
      avisar(r.mensaje); alTerminar();
    } catch (e) { setError(e.message); setPin(''); }
  };

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <div className="d-flex justify-content-between"><strong>Pedido #{pedido.codigo_pedido.split('-').pop()}</strong><EstadoPedido estado={pedido.estado} /></div>
        <div className="small mt-1"><i className="bi bi-person me-1" />{pedido.cliente?.nombre} · <a href={`tel:${pedido.cliente?.telefono}`}>{pedido.cliente?.telefono}</a></div>
        <div className="small text-secondary"><i className="bi bi-shop me-1" />{pedido.restaurante_id?.nombre} · {pedido.restaurante_id?.direccion}</div>
        <div className="small text-secondary"><i className="bi bi-bag me-1" />{pedido.detalles?.map((d) => `${d.cantidad} × ${d.nombre_platillo}`).join(' · ')}</div>
        <Button variant={avisado ? 'outline-success' : 'success'} className="w-100 mt-3" onClick={avisarCerca} disabled={avisado || enviando}>
          <i className={`bi bi-${avisado ? 'check2' : 'geo-alt-fill'} me-1`} />{avisado ? 'El cliente sabe que llegas pronto' : 'Estoy a 5 minutos: avisar al cliente'}
        </Button>
        <hr />
        <p className="text-center fw-semibold mb-2">Pide el PIN al cliente</p>
        <div className={`digitos mb-2 ${error ? 'error' : ''}`} aria-live="polite" aria-label={`${pin.length} de 4 dígitos ingresados`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={pin[i] ? 'lleno' : ''}>{pin[i] ? '•' : ''}</span>)}
        </div>
        {error && <Alert variant="danger" className="py-2 small text-center" role="alert">{error}</Alert>}
        <div className="teclado mt-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Button key={d} variant="light" className="border" onClick={() => tocar(d)}>{d}</Button>)}
          <Button variant="light" className="border" onClick={() => setPin('')} aria-label="Borrar todo"><i className="bi bi-x-circle" /></Button>
          <Button variant="light" className="border" onClick={() => tocar('0')}>0</Button>
          <Button variant="light" className="border" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Borrar un dígito"><i className="bi bi-backspace" /></Button>
        </div>
        <Button size="lg" className="w-100 mt-3" disabled={pin.length !== 4 || enviando} onClick={validar}>
          {enviando ? <Spinner size="sm" /> : <><i className="bi bi-check2-circle me-1" />Confirmar entrega</>}
        </Button>
      </Card.Body>
    </Card>
  );
}

export default function Reparto() {
  useTitulo('Reparto');
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const { enviando, ejecutar } = useAccion();
  const [pestana, setPestana] = useState('mios');
  const [activo, setActivo] = useState(null);
  const { datos, error, cargando, recargar } = useCarga(() => api.pedidos(), [], { cadaMs: 15000 });
  const [disponible, setDisponible] = useState(usuario?.estado !== 'Desconectado');
  const { actualizarUsuario } = useSesion();

  const cambiarDisponible = async (valor) => {
    try {
      const r = await api.disponibilidad(valor ? 'Disponible' : 'Desconectado');
      setDisponible(valor); actualizarUsuario({ estado: r.estado }); avisar(r.mensaje);
    } catch (e) { avisar(e.message, 'error'); }
  };

  const todos = datos || [];
  const mios = todos.filter((p) => String(p.repartidor_id?._id) === String(usuario?.id) && p.estado === 'En Camino');
  const libres = todos.filter((p) => !p.repartidor_id && ['En Preparación', 'En Camino'].includes(p.estado));
  const historial = todos.filter((p) => p.estado === 'Entregado');
  const listas = { mios, libres, historial };

  const aceptar = async (p) => {
    try {
      const r = await ejecutar(() => api.aceptar(p.codigo_pedido));
      avisar(r.mensaje); await recargar(true); setPestana('mios'); setActivo(p.codigo_pedido);
    } catch (e) { avisar(e.message, 'error'); recargar(true); }
  };

  const pedidoActivo = mios.find((p) => p.codigo_pedido === activo) || (pestana === 'mios' && mios.length === 1 ? mios[0] : null);

  return (
    <>
      <h1 className="h4 mb-3">Hola, {usuario?.nombre?.split(' ')[0]}</h1>
      <Card className={`mb-3 border-0 ${disponible ? 'bg-verde-claro' : 'bg-light'}`}>
        <Card.Body className="d-flex justify-content-between align-items-center py-2">
          <div><div className="fw-semibold">{disponible ? 'Disponible' : 'Desconectado'}</div>
            <small className="text-secondary">{disponible ? 'Los locales pueden asignarte pedidos' : 'No recibirás pedidos nuevos'}</small></div>
          <Form.Check type="switch" id="disponible" className="fs-4" checked={disponible} onChange={(e) => cambiarDisponible(e.target.checked)} aria-label="Estoy disponible" />
        </Card.Body>
      </Card>
      <Nav variant="pills" className="mb-3 nav-fill bg-white rounded-3 p-1 border" activeKey={pestana} onSelect={(k) => { setPestana(k); setActivo(null); }}>
        <Nav.Item><Nav.Link eventKey="mios">En ruta <Badge bg="warning" text="dark" pill>{mios.length}</Badge></Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="libres">Disponibles <Badge bg="secondary" pill>{libres.length}</Badge></Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="historial">Historial</Nav.Link></Nav.Item>
      </Nav>
      {error && <ErrorCarga error={error} alReintentar={recargar} />}
      {cargando ? <Esqueleto filas={2} /> : pedidoActivo ? (
        <>
          {mios.length > 1 && <Button variant="link" className="px-0 mb-2" onClick={() => setActivo(null)}><i className="bi bi-arrow-left me-1" />Volver a la lista</Button>}
          <ValidarPin key={pedidoActivo._id} pedido={pedidoActivo} alTerminar={() => { setActivo(null); recargar(true); }} />
        </>
      ) : !listas[pestana].length ? (
        <Vacio icono={pestana === 'historial' ? 'clock-history' : 'scooter'} titulo={pestana === 'mios' ? 'No tienes entregas en ruta' : pestana === 'libres' ? 'No hay pedidos disponibles' : 'Aún no has entregado pedidos'}
          texto={pestana === 'mios' ? 'Acepta un pedido disponible o espera que un local te asigne uno.' : undefined} />
      ) : (
        <div className="d-grid gap-2">
          {listas[pestana].map((p) => (
            <Card key={p._id}>
              <Card.Body className="d-flex justify-content-between align-items-center gap-2">
                <div>
                  <div className="fw-semibold">#{p.codigo_pedido.split('-').pop()} · {p.restaurante_id?.nombre}</div>
                  <small className="text-secondary">{p.cliente?.nombre} · {p.detalles?.reduce((s, d) => s + d.cantidad, 0)} platillos · {pestana === 'historial' ? fecha(p.updatedAt || p.fecha_pedido) : clp(p.total)}</small>
                </div>
                {pestana === 'libres' && <Button size="sm" disabled={enviando} onClick={() => aceptar(p)}>Aceptar</Button>}
                {pestana === 'mios' && <Button size="sm" variant="warning" onClick={() => setActivo(p.codigo_pedido)}>Validar PIN</Button>}
                {pestana === 'historial' && <EstadoPedido estado={p.estado} />}
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
