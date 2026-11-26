/**
 * Carga los datos de ejemplo en MongoDB y PostgreSQL (npm run seed).
 * ¡OJO! Borra y vuelve a crear las colecciones de Kalo y las tablas cuentas, sesiones, pagos y accesos.
 * Todas las cuentas de prueba usan la contraseña Kalo1234, guardada como hash bcrypt.
 * Los índices de transparencia, el IMC y la meta calórica se calculan con las mismas funciones
 * que usa la API; los datos de salud quedan cifrados (RNF-02).
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { conectarMongo, mongoose } = require('../src/config/mongo');
const { conectarPostgres, consultar, postgresListo, cerrarPostgres } = require('../src/config/postgres');
const Usuario = require('../src/Modelos/mongo/Usuario');
const PlanNutricional = require('../src/Modelos/mongo/PlanNutricional');
const Restaurante = require('../src/Modelos/mongo/Restaurante');
const Repartidor = require('../src/Modelos/mongo/Repartidor');
const Platillo = require('../src/Modelos/mongo/Platillo');
const Pedido = require('../src/Modelos/mongo/Pedido');
const FotoCocina = require('../src/Modelos/mongo/FotoCocina');
const Notificacion = require('../src/Modelos/mongo/Notificacion');
const { armarPerfil } = require('../src/utils/perfil');
const { calcularIndiceTransparencia } = require('../src/utils/nutricion');
const { recalcularIndiceRestaurante } = require('../src/utils/ranking');

const CLAVE_PRUEBA = 'Kalo1234';
const IMG = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=75`;
const PAGO = (n) => ({ metodo: 'credito', marca: 'Visa', ultimos4: '1111', referencia: `pay_sim_seed${String(n).padStart(12, '0')}` });
const HACE = (horas) => new Date(Date.now() - horas * 3600 * 1000);

async function poblar() {
    await conectarMongo();
    await conectarPostgres();
    if (mongoose.connection.readyState !== 1) throw new Error('No hay conexión con MongoDB (revisa MONGO_URI).');
    if (!postgresListo()) throw new Error('No hay conexión con PostgreSQL (revisa DATABASE_URL).');
    await consultar('TRUNCATE accesos, sesiones, pagos, cuentas RESTART IDENTITY CASCADE');
    // Las contraseñas viven en PostgreSQL: cada perfil de MongoDB tiene su fila en cuentas
    const crearCuentas = async (docs, rol) => {
        for (const d of docs) {
            await consultar('INSERT INTO cuentas (mongo_id, rol, correo, password_hash) VALUES ($1, $2, $3, $4)', [String(d._id), rol, d.correo, HASH]);
        }
    };
    const HASH = await bcrypt.hash(CLAVE_PRUEBA, 10); // '$2a$10$...'

    // La colección antigua "Usuario" (Etapa 2 inicial) se reemplaza por "usuarios"
    try { await mongoose.connection.db.dropCollection('Usuario'); console.log('🧹 Colección antigua "Usuario" eliminada'); } catch (e) {}
    console.log('--- Iniciando carga de datos en MongoDB ---');

    // 1. Usuarios con perfil biométrico (IMC y meta con Mifflin-St Jeor, cifrados)
    const perfil = (datos) => armarPerfil(datos).perfil;
    await Usuario.deleteMany({});
    const usuarios = await Usuario.create([
        {
            nombre: 'Andrea Gómez', correo: 'andrea@mail.com', telefono: '+56912345678',
            perfil_biometrico: perfil({ peso: 68.5, altura: 1.65, edad: 28, genero: 'Femenino', nivel_actividad: 'ligero', objetivo: 'bajar' })
        },
        {
            nombre: 'Benjamín Figueroa', correo: 'benjamin.figueroam@estudiantes.uv.cl', telefono: '+56987654321',
            perfil_biometrico: perfil({ peso: 75, altura: 1.78, edad: 22, genero: 'Masculino', nivel_actividad: 'intenso', objetivo: 'subir' })
        },
        {
            nombre: 'Ariadna Espejo', correo: 'ariadna.espejo@mail.com', telefono: '+56955554444',
            perfil_biometrico: perfil({ peso: 62, altura: 1.68, edad: 23, genero: 'Femenino', nivel_actividad: 'moderado', objetivo: 'mantener' })
        }
    ]);
    await crearCuentas(usuarios, 'cliente');
    console.log(`✅ ${usuarios.length} usuarios creados (datos de salud cifrados, cuentas en PostgreSQL)`);

    // 2. Planes nutricionales
    await PlanNutricional.deleteMany({});
    const planes = await PlanNutricional.insertMany([
        { nombre_plan: 'Definición Muscular', calorias_diarias: 1800, objetivo: 'Pérdida de grasa y tonificación', precio_mensual: 49.99, tags: ['déficit calórico', 'alto en proteína', 'fitness'] },
        { nombre_plan: 'Volumen Limpio', calorias_diarias: 2600, objetivo: 'Ganancia de masa muscular magra', precio_mensual: 59.99, tags: ['superávit calórico', 'hipertrofia', 'energía'] },
        { nombre_plan: 'Salud y Vitalidad', calorias_diarias: 2000, objetivo: 'Mantenimiento y nutrición balanceada', precio_mensual: 39.99, tags: ['balanceado', 'antioxidantes', 'bienestar'] }
    ]);
    console.log(`✅ ${planes.length} planes creados`);

    // 3. Restaurantes
    await Restaurante.deleteMany({});
    const restaurantes = await Restaurante.insertMany([
        { nombre: 'Green Bowl Nutrición', correo: 'contacto@greenbowl.cl', especialidad: 'Bowls y ensaladas funcionales', direccion: 'Av. Libertad 450, Viña del Mar', telefono: '+56933445566' },
        { nombre: 'Protein Kitchen Kalo', correo: 'pedidos@proteinkitchen.cl', especialidad: 'Comidas altas en proteína y control de macros', direccion: 'Calle Prat 120, Valparaíso', telefono: '+56977889900' },
        { nombre: 'Huerta Fresca', correo: 'hola@huertafresca.cl', especialidad: 'Cocina vegetal de temporada', direccion: 'Cerro Alegre 233, Valparaíso', telefono: '+56944556677' }
    ]);
    const [greenBowl, protein, huerta] = restaurantes;
    await crearCuentas(restaurantes, 'restaurante');
    console.log(`✅ ${restaurantes.length} restaurantes creados`);

    // 4. Repartidores
    await Repartidor.deleteMany({});
    const repartidores = await Repartidor.insertMany([
        { nombre: 'Carlos Repartidor Express', correo: 'carlos.reparto@kalo.cl', telefono: '+56966112233', vehiculo: 'Motocicleta', estado: 'En Reparto', calificacion: 4.9 },
        { nombre: 'Matías Rojas', correo: 'matias.reparto@kalo.cl', telefono: '+56966445588', vehiculo: 'Bicicleta', estado: 'Disponible', calificacion: 4.7 }
    ]);
    await crearCuentas(repartidores, 'repartidor');
    console.log(`✅ ${repartidores.length} repartidores creados`);

    // 5. Platillos con receta estandarizada (RF-06) e índice calculado (RF-09)
    const ing = (nombre, cantidad_g, metodo_coccion, unidad = 'g') => ({ nombre, cantidad_g, unidad, metodo_coccion });
    const plato = (d) => {
        const { indice } = calcularIndiceTransparencia({
            proteinas: d.m[0], carbos: d.m[1], grasas: d.m[2], calorias: d.calorias, peso_porcion: d.peso_porcion_g,
            alergenos: d.alergenos, descripcion: d.descripcion, ingredientes: d.ingredientes, foto_propia: !!d.imagen_url
        });
        return {
            ...d, macronutrientes: { proteinas_g: d.m[0], carbohidratos_g: d.m[1], grasas_g: d.m[2] },
            indice_transparencia: indice, m: undefined
        };
    };
    await Platillo.deleteMany({});
    const platillos = await Platillo.insertMany([
        plato({
            nombre: 'Bowl de Salmón y Quinoa', categoria: 'Almuerzo', precio: 8500, calorias: 520, m: [38, 45, 18], peso_porcion_g: 380,
            descripcion: 'Salmón a la plancha sobre base de quinoa, palta, pepino y aderezo de sésamo.', alergenos: 'Pescado, sésamo',
            imagen_url: IMG('1546069901-ba9599a7e63c'), ingredientes_limpios: true, restaurante_id: greenBowl._id,
            ingredientes: [ing('Salmón', 120, 'Plancha'), ing('Quinoa', 120, 'Hervido'), ing('Palta', 50, 'Fresco'), ing('Pepino', 60, 'Fresco'), ing('Sésamo', 5, 'Fresco')]
        }),
        plato({
            nombre: 'Wrap Vegano Alto en Proteína', categoria: 'Almuerzo', precio: 6500, calorias: 410, m: [24, 50, 12], peso_porcion_g: 300,
            descripcion: 'Wrap integral con tofu salteado, hummus de garbanzo, espinacas y chía.', alergenos: 'Gluten, soya',
            imagen_url: IMG('1512621776951-a57141f2eefd'), restaurante_id: greenBowl._id,
            ingredientes: [ing('Tortilla integral', 70, 'Horno'), ing('Tofu', 100, 'Salteado'), ing('Hummus', 50, 'Fresco'), ing('Espinaca', 30, 'Fresco'), ing('Chía', 5, 'Fresco')]
        }),
        plato({
            nombre: 'Yogur Griego con Frutos Rojos', categoria: 'Desayuno', precio: 4200, calorias: 290, m: [20, 32, 8], peso_porcion_g: 280,
            descripcion: 'Yogur griego natural con frutillas, arándanos, avena tostada y un toque de miel.', alergenos: 'Lácteos, gluten',
            imagen_url: IMG('1488477181946-6428a0291777'), ingredientes_limpios: true, restaurante_id: greenBowl._id,
            ingredientes: [ing('Yogur griego', 200, 'Fresco'), ing('Frutilla', 40, 'Fresco'), ing('Arándano', 30, 'Fresco'), ing('Avena', 20, 'Horno'), ing('Miel', 7, 'Fresco')]
        }),
        plato({
            nombre: 'Pechuga Fit con Batata Asada', categoria: 'Almuerzo', precio: 7900, calorias: 480, m: [46, 40, 9], peso_porcion_g: 400,
            descripcion: 'Pechuga de pollo marinada en finas hierbas con medallones de batata y espárragos.', alergenos: 'Sin alérgenos declarados',
            imagen_url: IMG('1598515214211-89d3c73ae83b'), ingredientes_limpios: true, restaurante_id: protein._id,
            ingredientes: [ing('Pechuga de pollo', 160, 'Plancha'), ing('Batata', 180, 'Horno'), ing('Espárrago', 60, 'Vapor'), ing('Aceite de oliva', 5, 'Fresco', 'ml')]
        }),
        plato({
            nombre: 'Omelette de Claras y Espinaca', categoria: 'Desayuno', precio: 5200, calorias: 260, m: [30, 14, ''], peso_porcion_g: 320,
            descripcion: 'Omelette de claras con espinaca, champiñones y pan integral tostado.', alergenos: 'Huevo, gluten',
            imagen_url: IMG('1525351484163-7529414344d8'), restaurante_id: protein._id,
            ingredientes: [ing('Clara de huevo', 180, 'Plancha'), ing('Espinaca', 40, 'Salteado'), ing('Champiñón', 50, 'Salteado'), ing('Pan integral', 35)]
        }),
        plato({
            nombre: 'Carne Magra con Arroz Integral', categoria: 'Cena', precio: 8900, calorias: 610, m: [44, 55, 20],
            descripcion: 'Posta de vacuno a la plancha con arroz integral y brócoli al vapor.',
            imagen_url: IMG('1504674900247-0877df9cc836'), restaurante_id: protein._id,
            ingredientes: [ing('Carne de vacuno', 150, 'Plancha'), ing('Arroz integral', 180, 'Hervido'), ing('Brócoli', 90, 'Vapor')]
        }),
        plato({
            nombre: 'Ensalada de Garbanzos y Kale', categoria: 'Almuerzo', precio: 6900, calorias: 450, m: [18, 52, 17], peso_porcion_g: 350,
            descripcion: 'Garbanzos especiados con kale, tomate cherry, cebolla morada y vinagreta de limón.', alergenos: 'Sin alérgenos declarados',
            imagen_url: IMG('1540420773420-3366772f4999'), ingredientes_limpios: true, restaurante_id: huerta._id,
            ingredientes: [ing('Garbanzo', 160, 'Hervido'), ing('Kale', 60, 'Fresco'), ing('Tomate', 80, 'Fresco'), ing('Cebolla', 20, 'Fresco'), ing('Aceite de oliva', 10, 'Fresco', 'ml')]
        }),
        plato({
            nombre: 'Crema de Zapallo y Lentejas', categoria: 'Cena', precio: 5600, calorias: 340, m: [16, 52, 6], peso_porcion_g: 400,
            descripcion: 'Crema de zapallo camote con lentejas rojas y semillas de zapallo tostadas.', alergenos: 'Sin alérgenos declarados',
            restaurante_id: huerta._id,
            stock: 0,
            ingredientes: [ing('Zapallo', 250, 'Hervido'), ing('Lenteja', 120, 'Hervido'), ing('Cebolla', 30, 'Salteado')]
        }),
        plato({
            nombre: 'Tostadas de Palta y Huevo', categoria: 'Snack', precio: 4800, calorias: 380, m: [16, 30, 22],
            descripcion: 'Pan integral con palta, huevo pochado y semillas.', alergenos: 'Gluten, huevo',
            imagen_url: IMG('1525351484163-7529414344d8'), restaurante_id: huerta._id,
            stock: 4,
            ingredientes: [ing('Pan integral', 60), ing('Palta', 70), ing('Huevo', 55)]
        })
    ]);
    const P = Object.fromEntries(platillos.map(p => [p.nombre, p]));
    console.log(`✅ ${platillos.length} platillos creados`);

    // 6. Galería de la cocina (RF-07)
    await FotoCocina.deleteMany({});
    await FotoCocina.insertMany([
        { restaurante_id: greenBowl._id, imagen: IMG('1556910103-1c02745aae4d'), descripcion: 'Zona de preparación en frío', area: 'Preparación' },
        { restaurante_id: greenBowl._id, imagen: IMG('1556911220-bff31c812dba'), descripcion: 'Cocina principal', area: 'Cocina' },
        { restaurante_id: protein._id, imagen: IMG('1414235077428-338989a2e8c0'), descripcion: 'Línea de plancha', area: 'Cocina' }
    ]);
    for (const r of restaurantes) {
        const f = await FotoCocina.findOne({ restaurante_id: r._id }, '_id');
        if (f) await Restaurante.updateOne({ _id: r._id }, { $set: { foto_cocina: `/api/mongo/restaurantes/fotos/${f._id}` } });
    }
    console.log('✅ Fotos de cocina creadas');

    // 7. Pedidos en todos los estados (con calorías y pago guardados)
    const andrea = usuarios[0];
    const refCliente = { usuario_id: andrea._id, nombre: andrea.nombre, correo: andrea.correo, telefono: andrea.telefono };
    const detalle = (p, cantidad = 1) => ({ platillo_id: p._id, nombre_platillo: p.nombre, cantidad, precio_unitario: p.precio, subtotal: p.precio * cantidad, calorias: p.calorias });
    const pedido = (codigo, estado, restaurante, detalles, extra = {}) => ({
        codigo_pedido: codigo, estado, tipo: 'platillos', cliente: refCliente, restaurante_id: restaurante._id, detalles,
        pago: PAGO(codigo.slice(-4)), total: detalles.reduce((s, d) => s + d.subtotal, 0) + 1490,
        total_calorias: detalles.reduce((s, d) => s + d.calorias * d.cantidad, 0), fecha_pedido: new Date(), ...extra
    });
    await Pedido.deleteMany({});
    await Pedido.insertMany([
        pedido('KALO-2026-0001', 'En Camino', greenBowl, [detalle(P['Bowl de Salmón y Quinoa'])], {
            repartidor_id: repartidores[0]._id, pin_seguridad: '4821', pin_generado_en: new Date(), despachado_en: new Date(),
            plan_adquirido: { plan_id: planes[0]._id, nombre_plan: planes[0].nombre_plan, calorias_diarias: planes[0].calorias_diarias, precio_historico: planes[0].precio_mensual }
        }),
        pedido('KALO-2026-0002', 'En Preparación', greenBowl, [detalle(P['Wrap Vegano Alto en Proteína'], 2)]),
        pedido('KALO-2026-0003', 'Pagado', greenBowl, [detalle(P['Yogur Griego con Frutos Rojos'])]),
        pedido('KALO-2026-0004', 'Entregado', protein, [detalle(P['Omelette de Claras y Espinaca'])], {
            repartidor_id: repartidores[1]._id, pin_seguridad: '1934', fecha_pedido: HACE(2), despachado_en: HACE(1.6), entregado_en: HACE(1.3)
        }),
        pedido('KALO-2026-0005', 'Entregado', greenBowl, [detalle(P['Bowl de Salmón y Quinoa'])], {
            repartidor_id: repartidores[0]._id, pin_seguridad: '7710', fecha_pedido: HACE(30), despachado_en: HACE(29.6), entregado_en: HACE(29.3),
            calificacion_transp: 5,
            evaluacion: { similitud_foto: 5, gramaje_porcion: 4, velocidad_prep: 5, calificacion_general: 5, comentario: 'Igual a la foto y muy fresco.', fecha_evaluacion: HACE(28) }
        }),
        pedido('KALO-2026-0006', 'Entregado', protein, [detalle(P['Pechuga Fit con Batata Asada'])], {
            repartidor_id: repartidores[1]._id, pin_seguridad: '5521', fecha_pedido: HACE(50), despachado_en: HACE(49.5), entregado_en: HACE(49.2),
            calificacion_transp: 4,
            evaluacion: { similitud_foto: 4, gramaje_porcion: 4, velocidad_prep: 3, calificacion_general: 4, comentario: 'Rico, la porción un poco menor a lo esperado.', fecha_evaluacion: HACE(48) }
        })
    ]);
    // Libro de pagos en PostgreSQL: un registro por cada pedido pagado
    const { rows: [cuentaAndrea] } = await consultar('SELECT id FROM cuentas WHERE correo = $1', [andrea.correo]);
    for (const p of await Pedido.find({}, 'codigo_pedido total pago').lean()) {
        await consultar(
            `INSERT INTO pagos (referencia, cuenta_id, codigo_pedido, concepto, monto, moneda, metodo, marca, ultimos4)
             VALUES ($1, $2, $3, 'platillos', $4, 'CLP', $5, $6, $7)`,
            [p.pago.referencia, cuentaAndrea.id, p.codigo_pedido, p.total, p.pago.metodo, p.pago.marca, p.pago.ultimos4]
        );
    }
    await Pedido.syncIndexes(); // crea los índices definidos en el modelo
    await Promise.all([Platillo.syncIndexes(), Restaurante.syncIndexes(), FotoCocina.syncIndexes(), Notificacion.syncIndexes()]);
    console.log('✅ 6 pedidos creados');

    // 8. Ranking de locales (RF-11, RF-14) y avisos limpios
    for (const r of restaurantes) await recalcularIndiceRestaurante(r._id);
    await Notificacion.deleteMany({});
    await Notificacion.create({ destinatario_id: greenBowl._id, rol: 'restaurante', tipo: 'nuevo_pedido', titulo: 'Nuevo pedido pagado', mensaje: 'Andrea Gómez pagó el pedido #0003 (1 platillos).', codigo_pedido: 'KALO-2026-0003' });
    console.log('✅ Índices de transparencia de los locales calculados');

    console.log(`🔑 Cuentas de prueba (contraseña ${CLAVE_PRUEBA}): andrea@mail.com · contacto@greenbowl.cl · carlos.reparto@kalo.cl`);
    console.log('🎉 ¡Base de datos lista!');
    await mongoose.disconnect();
    await cerrarPostgres();
}

poblar().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
