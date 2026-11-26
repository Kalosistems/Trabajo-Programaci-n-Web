/**
 * Cálculos nutricionales de Kalo.
 * - RF-02: IMC = peso / altura² y su estado.
 * - RF-03: meta calórica diaria con la fórmula de Mifflin-St Jeor, el nivel de actividad y el objetivo.
 * - RF-08: servicio de cálculo nutricional: suma calorías y macronutrientes a partir de los ingredientes
 *          (tabla de referencia por 100 g, valores aproximados de USDA FoodData Central).
 * - RF-09: Índice de Transparencia del platillo (1 a 100).
 * El frontend repite el cálculo del índice para la vista previa (frontend/src/utils/transparencia.js).
 */

// ── RF-02 · IMC ──────────────────────────────────────────────────────
function calcularImc(pesoKg, alturaM) {
    if (!(pesoKg > 0) || !(alturaM > 0)) return null;
    return parseFloat((pesoKg / (alturaM * alturaM)).toFixed(1));
}

function estadoImc(imc) {
    if (!(imc > 0)) return 'Sin datos';
    if (imc < 18.5) return 'Bajo peso';
    if (imc < 25) return 'Peso saludable';
    if (imc < 30) return 'Sobrepeso';
    return 'Obesidad';
}

// ── RF-03 · Meta calórica ────────────────────────────────────────────
const ACTIVIDAD = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, intenso: 1.725 };
const OBJETIVOS = {
    bajar: { ajuste: -400, texto: 'Pérdida de grasa y tonificación' },
    mantener: { ajuste: 0, texto: 'Mantenimiento y nutrición balanceada' },
    subir: { ajuste: 300, texto: 'Ganancia de masa muscular magra' }
};

// Mifflin-St Jeor: 10·peso + 6,25·altura(cm) − 5·edad + (5 hombre | −161 mujer | −78 otro)
function calcularMetaCalorica({ peso_kg, altura_m, edad, genero, nivel_actividad = 'ligero', objetivo = 'mantener' }) {
    const constante = genero === 'Masculino' ? 5 : genero === 'Femenino' ? -161 : -78;
    const tmb = 10 * peso_kg + 6.25 * (altura_m * 100) - 5 * edad + constante;
    const total = tmb * (ACTIVIDAD[nivel_actividad] || ACTIVIDAD.ligero) + (OBJETIVOS[objetivo] || OBJETIVOS.mantener).ajuste;
    return Math.max(1200, Math.round(total / 50) * 50); // nunca menos de 1.200 kcal
}

// ── RF-08 · Tabla de alimentos (por 100 g o 100 ml) ──────────────────
// [nombres que reconoce, kcal, proteínas, carbohidratos, grasas]
const ALIMENTOS = [
    [['pechuga de pollo', 'pollo'], 165, 31, 0, 3.6],
    [['pavo'], 135, 30, 0, 1],
    [['jamon de pavo'], 104, 17, 2, 3],
    [['carne molida', 'vacuno', 'carne', 'posta', 'lomo liso'], 217, 26, 0, 12],
    [['cerdo', 'lomo de cerdo'], 143, 26, 0, 3.5],
    [['tocino'], 541, 37, 1.4, 42],
    [['salmon'], 208, 20, 0, 13],
    [['atun'], 116, 26, 0, 0.8],
    [['merluza', 'reineta', 'pescado'], 90, 18, 0, 1.3],
    [['camaron'], 99, 24, 0.2, 0.3],
    [['clara de huevo', 'clara'], 52, 11, 0.7, 0.2],
    [['huevo'], 155, 13, 1.1, 11],
    [['tofu'], 76, 8, 1.9, 4.8],
    [['tempeh'], 192, 20, 7.6, 11],
    [['proteina en polvo', 'whey'], 400, 80, 8, 6],
    [['garbanzo'], 164, 8.9, 27, 2.6],
    [['lenteja'], 116, 9, 20, 0.4],
    [['poroto', 'frijol'], 127, 8.7, 23, 0.5],
    [['hummus'], 166, 7.9, 14, 9.6],
    [['quinoa', 'quinua'], 120, 4.4, 21, 1.9],
    [['arroz integral'], 112, 2.3, 24, 0.8],
    [['arroz'], 130, 2.7, 28, 0.3],
    [['avena'], 389, 17, 66, 7],
    [['granola'], 471, 10, 64, 20],
    [['pasta', 'fideo', 'espagueti'], 158, 5.8, 31, 0.9],
    [['pan integral'], 247, 13, 41, 3.4],
    [['pan pita'], 275, 9, 56, 1.2],
    [['tortilla', 'wrap'], 310, 9, 51, 8],
    [['pan', 'marraqueta'], 265, 9, 49, 3.2],
    [['papa'], 87, 1.9, 20, 0.1],
    [['batata', 'camote'], 86, 1.6, 20, 0.1],
    [['choclo', 'maiz'], 96, 3.4, 21, 1.5],
    [['palta', 'aguacate'], 160, 2, 8.5, 14.7],
    [['lechuga'], 15, 1.4, 2.9, 0.2],
    [['espinaca'], 23, 2.9, 3.6, 0.4],
    [['rucula'], 25, 2.6, 3.7, 0.7],
    [['kale'], 35, 2.9, 4.4, 1.5],
    [['tomate'], 18, 0.9, 3.9, 0.2],
    [['pepino'], 15, 0.7, 3.6, 0.1],
    [['zanahoria'], 41, 0.9, 10, 0.2],
    [['brocoli'], 34, 2.8, 7, 0.4],
    [['esparrago'], 20, 2.2, 3.9, 0.1],
    [['zapallo italiano', 'zucchini'], 17, 1.2, 3.1, 0.3],
    [['zapallo'], 26, 1, 6.5, 0.1],
    [['pimenton'], 31, 1, 6, 0.3],
    [['cebolla'], 40, 1.1, 9.3, 0.1],
    [['champinon'], 22, 3.1, 3.3, 0.3],
    [['betarraga'], 43, 1.6, 10, 0.2],
    [['repollo'], 25, 1.3, 5.8, 0.1],
    [['edamame'], 121, 12, 9, 5],
    [['platano'], 89, 1.1, 23, 0.3],
    [['manzana'], 52, 0.3, 14, 0.2],
    [['frutilla'], 32, 0.7, 7.7, 0.3],
    [['arandano'], 57, 0.7, 14, 0.3],
    [['mango'], 60, 0.8, 15, 0.4],
    [['leche de almendra', 'leche vegetal'], 15, 0.6, 0.3, 1.2],
    [['leche descremada'], 34, 3.4, 5, 0.1],
    [['leche'], 61, 3.2, 4.8, 3.3],
    [['yogur griego'], 59, 10, 3.6, 0.4],
    [['yogur', 'yogurt'], 61, 3.5, 4.7, 3.3],
    [['quesillo', 'queso fresco', 'queso cottage'], 98, 11, 3.4, 4.3],
    [['mozzarella'], 280, 28, 3.1, 17],
    [['queso'], 350, 25, 1.3, 27],
    [['aceite de oliva', 'aceite'], 884, 0, 0, 100, 0.92],
    [['mantequilla de mani'], 588, 25, 20, 50],
    [['mantequilla'], 717, 0.9, 0.1, 81],
    [['almendra'], 579, 21, 22, 50],
    [['nuez'], 654, 15, 14, 65],
    [['mani'], 567, 26, 16, 49],
    [['chia'], 486, 17, 42, 31],
    [['sesamo'], 573, 18, 23, 50],
    [['miel'], 304, 0.3, 82, 0],
    [['azucar'], 387, 0, 100, 0],
    [['salsa de soya', 'soya'], 53, 8, 4.9, 0.6],
    [['mayonesa'], 680, 1, 0.6, 75],
    [['agua'], 0, 0, 0, 0]
];

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Índice de búsqueda: cada nombre conocido, del más largo al más corto
// (así "leche de almendra" gana a "leche" y "arroz integral" gana a "arroz")
const INDICE_NOMBRES = ALIMENTOS
    .flatMap(([nombres, kcal, p, c, g, densidad = 1]) => nombres.map(n => ({ n, nombre: nombres[0], kcal, p, c, g, densidad })))
    .sort((a, b) => b.n.length - a.n.length);

function buscarAlimento(nombre) {
    const t = normalizar(nombre);
    if (!t) return null;
    // Se acepta el nombre en plural (ej. "garbanzos", "champiñones")
    return INDICE_NOMBRES.find(a => new RegExp(`(^|\\s)${a.n}(es|s)?(\\s|$)`).test(t)) || null;
}

// Nombres para el autocompletado del formulario "Crear platillo"
function listaAlimentos() {
    return ALIMENTOS.map(([nombres, kcal, p, c, g]) => ({
        nombre: nombres[0], kcal_100g: kcal, proteinas_100g: p, carbohidratos_100g: c, grasas_100g: g
    }));
}

const ABSORCION_FRITURA_G = 5; // gramos de aceite que absorben 100 g de alimento frito

// RF-08: recibe [{ nombre, cantidad_g, unidad, metodo_coccion }] y devuelve los totales del platillo.
// "externos" trae los valores por 100 g obtenidos de USDA FoodData Central (src/servicios/usda.js),
// indexados por el nombre del alimento; si un alimento no está ahí, se usa la tabla de referencia.
function calcularNutrientes(ingredientes = [], externos = {}) {
    const total = { calorias: 0, proteinas: 0, carbos: 0, grasas: 0 };
    const reconocidos = [];
    const noReconocidos = [];
    for (const ing of ingredientes) {
        const cantidad = parseFloat(ing.cantidad_g) || 0;
        if (!ing.nombre || cantidad <= 0) continue;
        const a = buscarAlimento(ing.nombre);
        if (!a) { noReconocidos.push(ing.nombre); continue; }
        const v = externos[a.nombre] || { kcal: a.kcal, p: a.p, c: a.c, g: a.g, fuente: 'Tabla Kalo' };
        const gramos = ing.unidad === 'ml' ? cantidad * a.densidad : cantidad;
        const f = gramos / 100;
        let grasas = v.g * f;
        let kcal = v.kcal * f;
        if (ing.metodo_coccion === 'Frito') { // la fritura agrega aceite
            const aceite = ABSORCION_FRITURA_G * f;
            grasas += aceite;
            kcal += aceite * 9;
        }
        total.calorias += kcal;
        total.proteinas += v.p * f;
        total.carbos += v.c * f;
        total.grasas += grasas;
        reconocidos.push({ ingrediente: ing.nombre, alimento: a.nombre, gramos: Math.round(gramos), kcal: Math.round(kcal), fuente: v.fuente, fdc_id: v.fdc_id || null });
    }
    const r1 = (n) => Math.round(n * 10) / 10;
    return {
        calorias: Math.round(total.calorias),
        proteinas: r1(total.proteinas),
        carbos: r1(total.carbos),
        grasas: r1(total.grasas),
        reconocidos,
        no_reconocidos: noReconocidos
    };
}

// ── RF-09 · Índice de Transparencia del platillo ─────────────────────
const METODOS_COCCION = ['Fresco', 'Plancha', 'Horno', 'Hervido', 'Vapor', 'Salteado', 'Frito', 'Grillado', 'Crudo'];

// Evalúa qué tan completa y específica es la información del platillo. Devuelve el puntaje (1 a 100)
// y el detalle de cada criterio, para mostrarle al restaurante cómo subirlo.
function calcularIndiceTransparencia(d = {}) {
    const n = (v) => parseFloat(v) || 0;
    // Un macro está informado si trae un número (0 también cuenta: el pollo no tiene carbohidratos)
    const informado = (v) => v !== undefined && v !== null && String(v).trim() !== '' && parseFloat(v) >= 0;
    const ings = (Array.isArray(d.ingredientes) ? d.ingredientes : []).filter(i => i && String(i.nombre || '').trim());
    const conCantidad = ings.filter(i => n(i.cantidad_g) > 0).length;
    const conMetodo = ings.filter(i => METODOS_COCCION.includes(i.metodo_coccion)).length;

    const detalle = [
        ['Nombre, precio y calorías', 20, 20],
        ['Proteínas, carbohidratos y grasas', 15, [d.proteinas, d.carbos, d.grasas].filter(informado).length * 5],
        ['Peso de la porción', 10, n(d.peso_porcion) > 0 ? 10 : 0],
        ['Alérgenos declarados', 5, String(d.alergenos || '').trim().length > 2 ? 5 : 0],
        ['Descripción del plato', 5, String(d.descripcion || '').trim().length >= 20 ? 5 : 0],
        ['Foto propia del platillo', 5, d.foto_propia ? 5 : 0],
        ['Lista de ingredientes', 10, ings.length ? 10 : 0],
        ['Gramos de cada ingrediente', 20, ings.length ? Math.round(20 * conCantidad / ings.length) : 0],
        ['Método de cocción de cada ingrediente', 10, ings.length ? Math.round(10 * conMetodo / ings.length) : 0]
    ].map(([criterio, max, puntos]) => ({ criterio, max, puntos }));

    let indice = detalle.reduce((s, x) => s + x.puntos, 0);

    // Coherencia: si informa los tres macros, las calorías deben calzar con 4·P + 4·C + 9·G (±25 %)
    const [p, c, g, kcal] = [n(d.proteinas), n(d.carbos), n(d.grasas), n(d.calorias)];
    if ([d.proteinas, d.carbos, d.grasas].every(informado) && kcal > 0) {
        const kcalMacros = 4 * p + 4 * c + 9 * g;
        const coherente = Math.abs(kcalMacros - kcal) / kcal <= 0.25;
        detalle.push({ criterio: 'Calorías coherentes con los macros', max: 0, puntos: coherente ? 0 : -10 });
        if (!coherente) indice -= 10;
    }
    return { indice: Math.max(1, Math.min(100, indice)), detalle };
}

module.exports = {
    calcularImc, estadoImc, calcularMetaCalorica, ACTIVIDAD, OBJETIVOS,
    calcularNutrientes, listaAlimentos, buscarAlimento,
    calcularIndiceTransparencia, METODOS_COCCION
};
