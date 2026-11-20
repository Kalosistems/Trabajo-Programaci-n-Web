import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CarritoContexto = createContext(null);
const CLAVE = 'kalo_carrito';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { return []; } };

// Cada item: { platillo: { _id, nombre, precio, calorias, imagen_url, restaurante: { _id, nombre } }, cantidad }
// Un pedido es de un solo restaurante (la API responde 422 VARIOS_RESTAURANTES si no).
export function ProveedorCarrito({ children }) {
  const [items, setItems] = useState(leer);

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(items)); } catch { /* sin almacenamiento */ }
  }, [items]);

  const valor = useMemo(() => {
    const restaurante = items[0]?.platillo.restaurante || null;
    const subtotal = items.reduce((s, i) => s + i.platillo.precio * i.cantidad, 0);
    const kcal = items.reduce((s, i) => s + i.platillo.calorias * i.cantidad, 0);
    const unidades = items.reduce((s, i) => s + i.cantidad, 0);

    const resumir = (p) => ({
      _id: p._id, nombre: p.nombre, precio: p.precio, calorias: p.calorias, imagen_url: p.imagen_url,
      restaurante: { _id: p.restaurante_id?._id, nombre: p.restaurante_id?.nombre }
    });
    const esDeOtroLocal = (p) => !!restaurante && restaurante._id !== p.restaurante_id?._id;

    const agregar = (p, cantidad = 1) => setItems((prev) => {
      const base = prev.length && prev[0].platillo.restaurante._id !== p.restaurante_id?._id ? [] : prev;
      const existe = base.find((i) => i.platillo._id === p._id);
      if (existe) return base.map((i) => (i.platillo._id === p._id ? { ...i, cantidad: Math.min(20, i.cantidad + cantidad) } : i));
      return [...base, { platillo: resumir(p), cantidad }];
    });
    const cambiarCantidad = (id, cantidad) => setItems((prev) => prev.map((i) => (i.platillo._id === id ? { ...i, cantidad: Math.max(1, Math.min(20, cantidad)) } : i)));
    const quitar = (id) => setItems((prev) => prev.filter((i) => i.platillo._id !== id));
    const vaciar = () => setItems([]);

    return { items, restaurante, subtotal, kcal, unidades, esDeOtroLocal, agregar, cambiarCantidad, quitar, vaciar };
  }, [items]);

  return <CarritoContexto.Provider value={valor}>{children}</CarritoContexto.Provider>;
}

export const useCarrito = () => useContext(CarritoContexto);
