import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSesion, INICIO_POR_ROL } from './contexto/Sesion';
import { Cargando } from './componentes/Estados';
import { AvisoSinConexion } from './contexto/Accesibilidad';
import LayoutCliente from './componentes/LayoutCliente';
import LayoutRestaurante from './componentes/LayoutRestaurante';
import LayoutRepartidor from './componentes/LayoutRepartidor';
import Bienvenida from './paginas/Bienvenida';
import Entrar from './paginas/Entrar';

// Code splitting: cada grupo de pantallas se descarga solo cuando se necesita
const Registro = lazy(() => import('./paginas/Registro'));
const NoEncontrado = lazy(() => import('./paginas/NoEncontrado'));
const Explorar = lazy(() => import('./paginas/cliente/Explorar'));
const Carrito = lazy(() => import('./paginas/cliente/Carrito'));
const MisPedidos = lazy(() => import('./paginas/cliente/MisPedidos'));
const Perfil = lazy(() => import('./paginas/cliente/Perfil'));
const Restaurantes = lazy(() => import('./paginas/cliente/Restaurantes'));
const PerfilLocal = lazy(() => import('./paginas/cliente/PerfilLocal'));
const PedidosLocal = lazy(() => import('./paginas/restaurante/PedidosLocal'));
const Platillos = lazy(() => import('./paginas/restaurante/Platillos'));
const NuevoPlatillo = lazy(() => import('./paginas/restaurante/NuevoPlatillo'));
const MiLocal = lazy(() => import('./paginas/restaurante/MiLocal'));
const Resumen = lazy(() => import('./paginas/restaurante/Resumen'));
const Reparto = lazy(() => import('./paginas/repartidor/Reparto'));

// Protege las rutas: sin sesión → login; con otro rol → su propia pantalla de inicio
function SoloRol({ rol, children }) {
  const { rol: actual } = useSesion();
  const ubicacion = useLocation();
  if (!actual) return <Navigate to="/entrar" replace state={{ desde: ubicacion.pathname }} />;
  if (actual !== rol) return <Navigate to={INICIO_POR_ROL[actual]} replace />;
  return children;
}

export default function App() {
  return (
    <>
      <a href="#contenido" className="visually-hidden-focusable btn btn-warning">Saltar al contenido</a>
      <AvisoSinConexion />
      <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/" element={<Bienvenida />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/registro" element={<Registro />} />

          <Route element={<SoloRol rol="cliente"><LayoutCliente /></SoloRol>}>
            <Route path="/explorar" element={<Explorar />} />
            <Route path="/carrito" element={<Carrito />} />
            <Route path="/pedidos" element={<MisPedidos />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/locales" element={<Restaurantes />} />
            <Route path="/locales/:id" element={<PerfilLocal />} />
          </Route>

          <Route element={<SoloRol rol="restaurante"><LayoutRestaurante /></SoloRol>}>
            <Route path="/local/pedidos" element={<PedidosLocal />} />
            <Route path="/local/platillos" element={<Platillos />} />
            <Route path="/local/platillos/nuevo" element={<NuevoPlatillo />} />
            <Route path="/local/mi-local" element={<MiLocal />} />
            <Route path="/local/resumen" element={<Resumen />} />
          </Route>

          <Route element={<SoloRol rol="repartidor"><LayoutRepartidor /></SoloRol>}>
            <Route path="/reparto" element={<Reparto />} />
          </Route>

          <Route path="*" element={<NoEncontrado />} />
        </Routes>
      </Suspense>
    </>
  );
}
