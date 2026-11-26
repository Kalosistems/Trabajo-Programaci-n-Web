/**
 * Servicio en la nube: USDA FoodData Central (https://fdc.nal.usda.gov), API pública del
 * Departamento de Agricultura de EE. UU. con la composición nutricional de miles de alimentos (RF-08).
 *
 * - Cada alimento que Kalo reconoce tiene una consulta en inglés afinada a las descripciones de USDA
 *   (base "SR Legacy", valores por 100 g).
 * - Los resultados se guardan en PostgreSQL (tabla alimentos_usda) para no repetir llamadas.
 * - Si la API no responde, no hay clave o el valor de USDA se aleja más de 40 % de la referencia
 *   (búsqueda que eligió otro alimento), se usa la tabla de referencia de Kalo.
 * La clave va en USDA_API_KEY (gratis en https://fdc.nal.usda.gov/api-key-signup).
 */
const { consultar, postgresListo } = require('../config/postgres');
const { buscarAlimento, calcularNutrientes } = require('../utils/nutricion');

const CLAVE = (process.env.USDA_API_KEY || 'DEMO_KEY').trim();
const URL_BUSQUEDA = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const TOLERANCIA = 0.4;
const NUTRIENTES = { kcal: 1008, p: 1003, c: 1005, g: 1004 }; // energía, proteína, carbohidratos, grasa

// Nombre del alimento en Kalo → consulta para USDA
const CONSULTAS = {
    'pechuga de pollo': 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
    pavo: 'Turkey, all classes, breast, meat only, cooked, roasted',
    'jamon de pavo': 'Turkey ham, sliced',
    'carne molida': 'Beef, top sirloin, steak, separable lean only, cooked, broiled',
    cerdo: 'Pork, fresh, loin, tenderloin, separable lean only, cooked, roasted',
    tocino: 'Pork, cured, bacon, cooked, pan-fried',
    salmon: 'Fish, salmon, Atlantic, farmed, cooked, dry heat',
    atun: 'Fish, tuna, light, canned in water, drained solids',
    merluza: 'Fish, cod, Atlantic, cooked, dry heat',
    camaron: 'Crustaceans, shrimp, cooked',
    'clara de huevo': 'Egg, white, raw, fresh',
    huevo: 'Egg, whole, cooked, hard-boiled',
    tofu: 'Tofu, raw, firm, prepared with calcium sulfate',
    tempeh: 'Tempeh',
    garbanzo: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt',
    lenteja: 'Lentils, mature seeds, cooked, boiled, without salt',
    poroto: 'Beans, black, mature seeds, cooked, boiled, without salt',
    hummus: 'Hummus, commercial',
    quinoa: 'Quinoa, cooked',
    'arroz integral': 'Rice, brown, long-grain, cooked',
    arroz: 'Rice, white, long-grain, regular, enriched, cooked',
    avena: 'Oats',
    pasta: 'Pasta, cooked, enriched, without added salt',
    'pan integral': 'Bread, whole-wheat, commercially prepared',
    papa: 'Potatoes, boiled, cooked without skin, flesh, without salt',
    batata: 'Sweet potato, cooked, baked in skin, flesh, without salt',
    choclo: 'Corn, sweet, yellow, cooked, boiled, drained, without salt',
    palta: 'Avocados, raw, all commercial varieties',
    lechuga: 'Lettuce, cos or romaine, raw',
    espinaca: 'Spinach, raw',
    kale: 'Kale, raw',
    tomate: 'Tomatoes, red, ripe, raw, year round average',
    pepino: 'Cucumber, with peel, raw',
    zanahoria: 'Carrots, raw',
    brocoli: 'Broccoli, raw',
    esparrago: 'Asparagus, raw',
    cebolla: 'Onions, raw',
    champinon: 'Mushrooms, white, raw',
    platano: 'Bananas, raw',
    manzana: 'Apples, raw, with skin',
    frutilla: 'Strawberries, raw',
    arandano: 'Blueberries, raw',
    leche: 'Milk, whole, 3.25% milkfat, with added vitamin D',
    'yogur griego': 'Yogurt, Greek, plain, nonfat',
    mozzarella: 'Cheese, mozzarella, whole milk',
    'aceite de oliva': 'Oil, olive, salad or cooking',
    almendra: 'Nuts, almonds',
    nuez: 'Nuts, walnuts, english',
    chia: 'Seeds, chia seeds, dried',
    miel: 'Honey'
};

async function desdeCache(consulta) {
    const { rows } = await consultar('SELECT fdc_id, descripcion, kcal, proteinas, carbos, grasas FROM alimentos_usda WHERE consulta = $1', [consulta]);
    return rows[0] || null;
}

async function guardarCache(consulta, d) {
    await consultar(
        `INSERT INTO alimentos_usda (consulta, fdc_id, descripcion, kcal, proteinas, carbos, grasas)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (consulta) DO UPDATE SET fdc_id = $2, descripcion = $3, kcal = $4, proteinas = $5, carbos = $6, grasas = $7, actualizado_en = now()`,
        [consulta, d.fdc_id, d.descripcion.slice(0, 200), d.kcal, d.proteinas, d.carbos, d.grasas]
    );
}

// Llama a la API de USDA (máx. 5 s) y devuelve los valores por 100 g del primer resultado
async function consultarApi(consulta) {
    const url = `${URL_BUSQUEDA}?${new URLSearchParams({ api_key: CLAVE, query: consulta, dataType: 'SR Legacy', pageSize: '1' })}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`USDA respondió ${r.status}`);
    const alimento = (await r.json()).foods?.[0];
    if (!alimento) return null;
    const valor = (id) => Number((alimento.foodNutrients || []).find((n) => n.nutrientId === id)?.value) || 0;
    return {
        fdc_id: alimento.fdcId, descripcion: alimento.description,
        kcal: valor(NUTRIENTES.kcal), proteinas: valor(NUTRIENTES.p), carbos: valor(NUTRIENTES.c), grasas: valor(NUTRIENTES.g)
    };
}

let estado = { ultimaLlamada: null, ultimoError: null, consultasApi: 0 };

async function valoresUsda(nombreKalo, referencia) {
    const consulta = CONSULTAS[nombreKalo];
    if (!consulta) return null;
    let d = postgresListo() ? await desdeCache(consulta).catch(() => null) : null;
    if (!d) {
        try {
            d = await consultarApi(consulta);
            estado = { ...estado, ultimaLlamada: new Date(), ultimoError: null, consultasApi: estado.consultasApi + 1 };
            if (d && postgresListo()) await guardarCache(consulta, d).catch(() => {});
        } catch (e) {
            estado = { ...estado, ultimoError: e.message };
            return null;
        }
    }
    if (!d || !(d.kcal >= 0)) return null;
    // Control de calidad: si la búsqueda trajo otro alimento, se descarta
    const diferencia = referencia.kcal ? Math.abs(d.kcal - referencia.kcal) / referencia.kcal : 0;
    if (diferencia > TOLERANCIA) return null;
    return { kcal: Number(d.kcal), p: Number(d.proteinas), c: Number(d.carbos), g: Number(d.grasas), fuente: 'USDA FoodData Central', fdc_id: d.fdc_id, descripcion_usda: d.descripcion };
}

// Calcula los nutrientes del platillo usando USDA para cada alimento reconocido
async function calcularConUsda(ingredientes = []) {
    const externos = {};
    const alimentos = [...new Map(ingredientes.map((i) => buscarAlimento(i.nombre)).filter(Boolean).map((a) => [a.nombre, a])).values()];
    await Promise.all(alimentos.map(async (a) => {
        const v = await valoresUsda(a.nombre, a);
        if (v) externos[a.nombre] = v;
    }));
    const resultado = calcularNutrientes(ingredientes, externos);
    const deUsda = resultado.reconocidos.filter((r) => r.fuente === 'USDA FoodData Central').length;
    resultado.fuente = deUsda
        ? `USDA FoodData Central (${deUsda} de ${resultado.reconocidos.length} ingrediente(s)); el resto, tabla de referencia de Kalo`
        : 'Tabla de referencia de Kalo (USDA no respondió o no tenía el alimento)';
    if (deUsda === resultado.reconocidos.length && deUsda) resultado.fuente = 'USDA FoodData Central';
    return resultado;
}

const estadoUsda = () => ({ clave: CLAVE === 'DEMO_KEY' ? 'DEMO_KEY (límite bajo)' : 'propia', ...estado });

module.exports = { calcularConUsda, estadoUsda, CONSULTAS };
