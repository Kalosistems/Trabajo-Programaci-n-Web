import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Dropdown } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { api, fecha } from '../api/cliente';
import { useAvisos } from '../contexto/Avisos';
import { useSesion } from '../contexto/Sesion';

const ICONO = {
  nuevo_pedido: 'bag-plus-fill', pedido_aceptado: 'fire', pedido_cancelado: 'x-octagon-fill', pedido_en_camino: 'scooter',
  repartidor_cerca: 'geo-alt-fill', pedido_entregado: 'check2-circle', evaluar: 'star-fill', nueva_evaluacion: 'star-half',
  pedido_asignado: 'person-check-fill', plan_contratado: 'clipboard2-heart-fill', pin_bloqueado: 'shield-exclamation'
};

// A dónde lleva cada aviso según el rol
const DESTINO = { cliente: '/pedidos', restaurante: '/local/pedidos', repartidor: '/reparto' };

// Campana de avisos (RF-12, RF-20, RF-23). Consulta la API cada 15 s; los avisos nuevos se muestran
// como mensaje en pantalla y, si la persona lo permitió, como notificación del navegador.
export default function Campana({ claro = false }) {
  const { rol } = useSesion();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ lista: [], noLeidas: 0 });
  const [permiso, setPermiso] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const vistos = useRef(null);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      if (document.visibilityState !== 'visible' && vistos.current) return;
      try {
        const r = await api.notificaciones();
        if (!vivo) return;
        setDatos({ lista: r.datos, noLeidas: r.no_leidas });
        const ids = new Set(r.datos.map((n) => n._id));
        if (vistos.current) {
          r.datos.filter((n) => !vistos.current.has(n._id) && !n.leida).reverse().forEach((n) => {
            avisar(`${n.titulo}: ${n.mensaje}`, 'info');
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try { new Notification(`Kalo · ${n.titulo}`, { body: n.mensaje, icon: '/favicon.svg', tag: n._id }); } catch { /* sin soporte */ }
            }
            window.dispatchEvent(new CustomEvent('kalo:aviso', { detail: n }));
          });
        }
        vistos.current = ids;
      } catch { /* sin conexión: se reintenta en el próximo ciclo */ }
    };
    cargar();
    const t = setInterval(cargar, 15000);
    return () => { vivo = false; clearInterval(t); };
  }, [avisar]);

  const abrir = async (abierto) => {
    if (!abierto || !datos.noLeidas) return;
    try { await api.marcarLeidas(); setDatos((d) => ({ ...d, noLeidas: 0 })); } catch { /* se intentará después */ }
  };

  const ir = (n) => navegar(DESTINO[rol], { state: { codigo: n.codigo_pedido, evaluar: n.tipo === 'evaluar' ? n.codigo_pedido : undefined } });

  const pedirPermiso = async () => {
    if (typeof Notification === 'undefined') return;
    setPermiso(await Notification.requestPermission());
  };

  return (
    <Dropdown align="end" onToggle={abrir}>
      <Dropdown.Toggle as={Button} variant={claro ? 'outline-light' : 'light'} size="sm" className="position-relative campana border-0" aria-label={`Avisos${datos.noLeidas ? `: ${datos.noLeidas} sin leer` : ''}`}>
        <i className="bi bi-bell fs-5" aria-hidden="true" />
        {datos.noLeidas > 0 && <Badge bg="danger" pill className="position-absolute top-0 start-100 translate-middle">{datos.noLeidas}</Badge>}
      </Dropdown.Toggle>
      <Dropdown.Menu className="menu-avisos shadow p-0">
        <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
          <strong>Avisos</strong>
          {permiso === 'default' && <Button size="sm" variant="link" className="p-0 small" onClick={pedirPermiso}>Activar en el navegador</Button>}
        </div>
        {!datos.lista.length && <div className="text-center text-secondary small py-4">No tienes avisos todavía</div>}
        <div className="lista-avisos">
          {datos.lista.map((n) => (
            <Dropdown.Item key={n._id} onClick={() => ir(n)} className={`d-flex gap-2 py-2 border-bottom ${n.leida ? '' : 'aviso-nuevo'}`}>
              <i className={`bi bi-${ICONO[n.tipo] || 'bell'} text-verde fs-5`} aria-hidden="true" />
              <div className="text-wrap">
                <div className="fw-semibold small">{n.titulo}</div>
                <div className="small text-secondary">{n.mensaje}</div>
                <div className="text-secondary" style={{ fontSize: '.7rem' }}>{fecha(n.createdAt)}</div>
              </div>
            </Dropdown.Item>
          ))}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
}
