// Índice de Transparencia del platillo (RF-09). Es el MISMO cálculo que hace el servidor
// (src/utils/nutricion.js → calcularIndiceTransparencia); aquí se usa para la vista previa en vivo.
export const METODOS_COCCION = ['Fresco', 'Plancha', 'Horno', 'Hervido', 'Vapor', 'Salteado', 'Frito', 'Grillado', 'Crudo'];

export function calcularIndice(d) {
  const n = (v) => parseFloat(v) || 0;
  const informado = (v) => v !== undefined && v !== null && String(v).trim() !== '' && parseFloat(v) >= 0;
  const ings = (d.ingredientes || []).filter((i) => String(i.nombre || '').trim());
  const conCantidad = ings.filter((i) => n(i.cantidad_g) > 0).length;
  const conMetodo = ings.filter((i) => METODOS_COCCION.includes(i.metodo_coccion)).length;

  const detalle = [
    ['Nombre, precio y calorías', 20, 20],
    ['Proteínas, carbohidratos y grasas', 15, [d.proteinas, d.carbos, d.grasas].filter(informado).length * 5],
    ['Peso de la porción', 10, n(d.peso_porcion) > 0 ? 10 : 0],
    ['Alérgenos declarados', 5, String(d.alergenos || '').trim().length > 2 ? 5 : 0],
    ['Descripción del plato', 5, String(d.descripcion || '').trim().length >= 20 ? 5 : 0],
    ['Foto propia del platillo', 5, d.imagen_url ? 5 : 0],
    ['Lista de ingredientes', 10, ings.length ? 10 : 0],
    ['Gramos de cada ingrediente', 20, ings.length ? Math.round((20 * conCantidad) / ings.length) : 0],
    ['Método de cocción de cada ingrediente', 10, ings.length ? Math.round((10 * conMetodo) / ings.length) : 0]
  ].map(([criterio, max, puntos]) => ({ criterio, max, puntos }));

  let indice = detalle.reduce((s, x) => s + x.puntos, 0);
  const [p, c, g, kcal] = [n(d.proteinas), n(d.carbos), n(d.grasas), n(d.calorias)];
  if ([d.proteinas, d.carbos, d.grasas].every(informado) && kcal > 0 && Math.abs(4 * p + 4 * c + 9 * g - kcal) / kcal > 0.25) {
    detalle.push({ criterio: 'Calorías no calzan con los macros (4·P + 4·C + 9·G)', max: 0, puntos: -10 });
    indice -= 10;
  }
  return { indice: Math.max(1, Math.min(100, indice)), detalle };
}

// RF-03: misma fórmula que el servidor (Mifflin-St Jeor), para mostrar la meta al registrarse
export const ACTIVIDADES = {
  sedentario: ['Sedentario', 'Poco o nada de ejercicio', 1.2],
  ligero: ['Ligero', 'Ejercicio 1 a 3 días por semana', 1.375],
  moderado: ['Moderado', 'Ejercicio 3 a 5 días por semana', 1.55],
  intenso: ['Intenso', 'Ejercicio 6 a 7 días por semana', 1.725]
};
export const OBJETIVOS = {
  bajar: ['Bajar de peso', -400],
  mantener: ['Mantener mi peso', 0],
  subir: ['Ganar masa muscular', 300]
};
export function metaCalorica({ peso, altura, edad, genero, nivel_actividad = 'ligero', objetivo = 'mantener' }) {
  const [w, h, a] = [parseFloat(peso), parseFloat(altura), parseInt(edad, 10)];
  if (!(w > 0 && h > 0 && a > 0)) return null;
  const c = genero === 'Masculino' ? 5 : genero === 'Femenino' ? -161 : -78;
  const total = (10 * w + 6.25 * h * 100 - 5 * a + c) * (ACTIVIDADES[nivel_actividad]?.[2] || 1.375) + (OBJETIVOS[objetivo]?.[1] || 0);
  return Math.max(1200, Math.round(total / 50) * 50);
}

export function estadoImc(imc) {
  if (!(imc > 0)) return ['Sin datos', 'secondary'];
  if (imc < 18.5) return ['Bajo peso', 'info'];
  if (imc < 25) return ['Peso saludable', 'success'];
  if (imc < 30) return ['Sobrepeso', 'warning'];
  return ['Obesidad', 'danger'];
}
