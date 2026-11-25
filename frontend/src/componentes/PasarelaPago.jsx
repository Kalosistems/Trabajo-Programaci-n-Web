import { useState } from 'react';
import { Alert, Button, ButtonGroup, Col, Form, Modal, Row, Spinner, ToggleButton } from 'react-bootstrap';
import { autorizarPago, luhnValido, marcaDe, TARJETAS_PRUEBA, vencimientoValido } from '../api/pasarela';
import { clp } from '../api/cliente';

const formatearNumero = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatearVenc = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// Ventana de pago (RNF-07). Los datos de la tarjeta se quedan en esta ventana y van solo a la
// pasarela; al terminar, alPagar recibe { referencia, marca, ultimos4, metodo }.
export default function PasarelaPago({ show, monto, concepto, alCerrar, alPagar }) {
  const [t, setT] = useState({ numero: '', titular: '', vencimiento: '', cvv: '', metodo: 'credito' });
  const [error, setError] = useState('');
  const [paso, setPaso] = useState('datos'); // datos | autorizando | confirmando
  const c = (k, f = (x) => x) => (e) => { setError(''); setT({ ...t, [k]: f(e.target.value) }); };

  const numeroMalo = t.numero.replace(/\D/g, '').length >= 13 && !luhnValido(t.numero);
  const vencMalo = t.vencimiento.length === 5 && !vencimientoValido(t.vencimiento);
  const listo = luhnValido(t.numero) && vencimientoValido(t.vencimiento) && /^\d{3,4}$/.test(t.cvv) && t.titular.trim();

  const cerrar = () => {
    if (paso !== 'datos') return;
    setT({ numero: '', titular: '', vencimiento: '', cvv: '', metodo: 'credito' }); setError(''); alCerrar();
  };

  const pagar = async (e) => {
    e.preventDefault();
    setError(''); setPaso('autorizando');
    try {
      const comprobante = await autorizarPago({ ...t, monto });
      setT({ numero: '', titular: '', vencimiento: '', cvv: '', metodo: 'credito' }); // se borran los datos de la tarjeta
      setPaso('confirmando');
      await alPagar(comprobante);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaso('datos');
    }
  };

  return (
    <Modal show={show} onHide={cerrar} centered backdrop={paso === 'datos' ? true : 'static'}>
      <Form onSubmit={pagar} noValidate>
        <Modal.Header closeButton={paso === 'datos'} className="border-0 pb-0">
          <Modal.Title as="h2" className="h5"><i className="bi bi-shield-lock-fill text-success me-2" aria-hidden="true" />Pago seguro</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="caja-pago rounded-4 p-3 mb-3 d-flex justify-content-between align-items-center">
            <div><div className="small opacity-75">{concepto}</div><div className="fs-3 fw-800">{clp(monto)}</div></div>
            <i className="bi bi-credit-card-2-front fs-1 opacity-75" aria-hidden="true" />
          </div>
          {error && <Alert variant="danger" className="small py-2" role="alert"><i className="bi bi-x-octagon me-1" />{error}</Alert>}
          <ButtonGroup className="w-100 mb-3" aria-label="Tipo de tarjeta">
            {[['credito', 'Crédito'], ['debito', 'Débito']].map(([v, txt]) => (
              <ToggleButton key={v} id={`metodo-${v}`} type="radio" name="metodo" value={v} variant="outline-primary" checked={t.metodo === v} onChange={c('metodo')}>{txt}</ToggleButton>
            ))}
          </ButtonGroup>
          <Form.Group className="mb-3" controlId="tNumero">
            <Form.Label>Número de la tarjeta</Form.Label>
            <div className="position-relative">
              <Form.Control inputMode="numeric" autoComplete="cc-number" value={t.numero} onChange={c('numero', formatearNumero)} placeholder="0000 0000 0000 0000" isInvalid={numeroMalo} />
              {t.numero && <span className="badge bg-light text-dark border position-absolute top-50 end-0 translate-middle-y me-2">{marcaDe(t.numero)}</span>}
              <Form.Control.Feedback type="invalid">Revisa el número: no es una tarjeta válida.</Form.Control.Feedback>
            </div>
          </Form.Group>
          <Form.Group className="mb-3" controlId="tTitular">
            <Form.Label>Nombre del titular</Form.Label>
            <Form.Control autoComplete="cc-name" value={t.titular} onChange={c('titular')} placeholder="Como aparece en la tarjeta" />
          </Form.Group>
          <Row className="g-3">
            <Col xs={6}><Form.Group controlId="tVenc"><Form.Label>Vencimiento</Form.Label>
              <Form.Control inputMode="numeric" autoComplete="cc-exp" value={t.vencimiento} onChange={c('vencimiento', formatearVenc)} placeholder="MM/AA" isInvalid={vencMalo} />
              <Form.Control.Feedback type="invalid">Fecha vencida o inválida.</Form.Control.Feedback></Form.Group></Col>
            <Col xs={6}><Form.Group controlId="tCvv"><Form.Label>CVV</Form.Label>
              <Form.Control inputMode="numeric" autoComplete="cc-csc" type="password" maxLength={4} value={t.cvv} onChange={c('cvv', (v) => v.replace(/\D/g, ''))} placeholder="123" /></Form.Group></Col>
          </Row>
          <details className="small text-secondary mt-3">
            <summary>Modo de prueba: tarjetas para la demostración</summary>
            <ul className="mb-0 mt-2">
              {TARJETAS_PRUEBA.map((x) => <li key={x.numero}><code>{x.numero}</code> · {x.resultado} · cualquier fecha futura y CVV</li>)}
            </ul>
          </details>
          <p className="small text-secondary mt-3 mb-0"><i className="bi bi-lock me-1" aria-hidden="true" />Kalo no guarda tu tarjeta: el pago lo procesa la pasarela (PCI-DSS) y solo recibimos la confirmación y los últimos 4 dígitos.</p>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button type="submit" size="lg" className="w-100" disabled={!listo || paso !== 'datos'}>
            {paso === 'autorizando' ? <><Spinner size="sm" className="me-2" />Autorizando con el banco…</>
              : paso === 'confirmando' ? <><Spinner size="sm" className="me-2" />Confirmando…</>
                : <>Pagar {clp(monto)}</>}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
