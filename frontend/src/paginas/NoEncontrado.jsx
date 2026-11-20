import { Button, Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Vacio } from '../componentes/Estados';
import { useTitulo } from '../hooks';

export default function NoEncontrado() {
  useTitulo('Página no encontrada');
  return (
    <main id="contenido"><Container className="py-5">
      <Vacio icono="signpost-split" titulo="No encontramos esta página" texto="Puede que el enlace esté mal escrito o que la página ya no exista.">
        <Button as={Link} to="/">Volver al inicio</Button>
      </Vacio>
    </Container></main>
  );
}
