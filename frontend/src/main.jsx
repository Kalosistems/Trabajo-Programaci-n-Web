import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './tema.css';
import App from './App';
import { ProveedorSesion } from './contexto/Sesion';
import { ProveedorCarrito } from './contexto/Carrito';
import { ProveedorAvisos } from './contexto/Avisos';
import { ProveedorAccesibilidad } from './contexto/Accesibilidad';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorAccesibilidad>
      <ProveedorSesion>
        <ProveedorCarrito>
          <ProveedorAvisos>
            <App />
          </ProveedorAvisos>
        </ProveedorCarrito>
      </ProveedorSesion>
      </ProveedorAccesibilidad>
    </BrowserRouter>
  </React.StrictMode>
);
