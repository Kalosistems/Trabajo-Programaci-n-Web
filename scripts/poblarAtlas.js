const path = require('path');
const fs = require('fs');
const rootEnv = path.join(__dirname, '..', '.env');
const altEnv = path.join(__dirname, '..', 'env');
if (fs.existsSync(rootEnv)) require('dotenv').config({ path: rootEnv });
else if (fs.existsSync(altEnv)) require('dotenv').config({ path: altEnv });
else require('dotenv').config();
const { conectarMongo } = require('../src/config/mongo');
const Usuario = require('../src/Modelos/mongo/Usuario');
const PlanNutricional = require('../src/Modelos/mongo/PlanNutricional');
const Restaurante = require('../src/Modelos/mongo/Restaurante');
const Repartidor = require('../src/Modelos/mongo/Repartidor');
const Platillo = require('../src/Modelos/mongo/Platillo');
const Pedido = require('../src/Modelos/mongo/Pedido');

async function poblar() {
    await conectarMongo();
    console.log('--- Iniciando carga de datos en MongoDB Atlas ---');

    // 1. Usuarios con perfil biométrico
    await Usuario.deleteMany({});
    const usuarios = await Usuario.insertMany([
        {
            nombre: 'Andrea Gómez',
            correo: 'andrea@mail.com',
            password_hash: '$2b$10$hashedAndrea1234567890123456789012345678901234',
            telefono: '+56912345678',
            perfil_biometrico: {
                peso_kg: 68.5,
                altura_m: 1.65,
                edad: 28,
                genero: 'Femenino',
                imc: 25.16,
                meta_calorica_diaria: 1850,
                objetivo_salud: 'Pérdida de grasa y tonificación'
            }
        },
        {
            nombre: 'Benjamín Figueroa',
            correo: 'benjamin.figueroam@estudiantes.uv.cl',
            password_hash: '$2b$10$hashedBenjamin12345678901234567890123456789012',
            telefono: '+56987654321',
            perfil_biometrico: {
                peso_kg: 75.0,
                altura_m: 1.78,
                edad: 22,
                genero: 'Masculino',
                imc: 23.67,
                meta_calorica_diaria: 2450,
                objetivo_salud: 'Ganancia de masa muscular magra'
            }
        },
        {
            nombre: 'Ariadna Espejo',
            correo: 'ariadna.espejo@mail.com',
            password_hash: '$2b$10$hashedAriadna123456789012345678901234567890123',
            telefono: '+56955554444',
            perfil_biometrico: {
                peso_kg: 62.0,
                altura_m: 1.68,
                edad: 23,
                genero: 'Femenino',
                imc: 21.97,
                meta_calorica_diaria: 2000,
                objetivo_salud: 'Mantenimiento y nutrición balanceada'
            }
        }
    ]);
    console.log('✅ 3 Usuarios creados');

    // 2. Planes Nutricionales
    await PlanNutricional.deleteMany({});
    const planes = await PlanNutricional.insertMany([
        {
            nombre_plan: 'Definición Muscular',
            calorias_diarias: 1800,
            objetivo: 'Pérdida de grasa y tonificación',
            precio_mensual: 49.99,
            tags: ['déficit calórico', 'alto en proteína', 'fitness']
        },
        {
            nombre_plan: 'Volumen Limpio',
            calorias_diarias: 2600,
            objetivo: 'Ganancia de masa muscular magra',
            precio_mensual: 59.99,
            tags: ['superávit calórico', 'hipertrofia', 'energía']
        },
        {
            nombre_plan: 'Salud y Vitalidad',
            calorias_diarias: 2000,
            objetivo: 'Mantenimiento y nutrición balanceada',
            precio_mensual: 39.99,
            tags: ['balanceado', 'antioxidantes', 'bienestar']
        }
    ]);
    console.log('✅ 3 Planes creados');

    // 3. Restaurantes
    await Restaurante.deleteMany({});
    const restaurantes = await Restaurante.insertMany([
        {
            nombre: 'Green Bowl Nutrición',
            correo: 'contacto@greenbowl.cl',
            password_hash: '$2b$10$hashRestauranteGreenBowl1234567890123456789012',
            especialidad: 'Bowls y Ensaladas Funcionales',
            direccion: 'Av. Libertad 450, Viña del Mar',
            telefono: '+56933445566',
            calificacion_promedio: 4.8
        },
        {
            nombre: 'Protein Kitchen Kalo',
            correo: 'pedidos@proteinkitchen.cl',
            password_hash: '$2b$10$hashRestauranteProtein12345678901234567890123',
            especialidad: 'Comidas altas en proteína y control de macros',
            direccion: 'Calle Prat 120, Valparaíso',
            telefono: '+56977889900',
            calificacion_promedio: 4.9
        }
    ]);
    console.log('✅ 2 Restaurantes creados');

    // 4. Repartidor
    await Repartidor.deleteMany({});
    const repartidores = await Repartidor.insertMany([
        {
            nombre: 'Carlos Repartidor Express',
            correo: 'carlos.reparto@kalo.cl',
            password_hash: '$2b$10$hashRepartidorCarlos12345678901234567890123456',
            telefono: '+56966112233',
            vehiculo: 'Motocicleta',
            estado: 'Disponible',
            calificacion: 4.9
        }
    ]);
    console.log('✅ 1 Repartidor creado');

    // 5. Platillos con macronutrientes y transparencia
    await Platillo.deleteMany({});
    const platillos = await Platillo.insertMany([
        {
            nombre: 'Bowl de Salmón y Quinoa',
            descripcion: 'Salmón a la plancha sobre base de quinoa, palta, pepino y aderezo de sésamo.',
            precio: 8500,
            calorias: 520,
            macronutrientes: { proteinas_g: 38, carbohidratos_g: 45, grasas_g: 18 },
            indice_transparencia: 98,
            restaurante_id: restaurantes[0]._id
        },
        {
            nombre: 'Pechuga Fit con Batata Asada',
            descripcion: 'Pechuga de pollo marinada en finas hierbas con medallones de batata y espárragos.',
            precio: 7900,
            calorias: 480,
            macronutrientes: { proteinas_g: 46, carbohidratos_g: 40, grasas_g: 9 },
            indice_transparencia: 96,
            restaurante_id: restaurantes[1]._id
        },
        {
            nombre: 'Wrap Vegano Alto en Proteína',
            descripcion: 'Wrap integral con tofu salteado, hummus de garbanzo, espinacas y chía.',
            precio: 6500,
            calorias: 410,
            macronutrientes: { proteinas_g: 24, carbohidratos_g: 50, grasas_g: 12 },
            indice_transparencia: 94,
            restaurante_id: restaurantes[0]._id
        }
    ]);
    console.log('✅ 3 Platillos creados');

    // 6. Pedido completo con PIN de 4 dígitos y Detalle_Pedido
    await Pedido.deleteMany({});
    await Pedido.insertMany([
        {
            codigo_pedido: 'KALO-2026-0001',
            fecha_pedido: new Date(),
            estado: 'En Camino',
            pin_seguridad: '4821',
            calificacion_transp: 5,
            cliente: {
                usuario_id: usuarios[0]._id,
                nombre: usuarios[0].nombre,
                correo: usuarios[0].correo,
                telefono: usuarios[0].telefono
            },
            restaurante_id: restaurantes[0]._id,
            repartidor_id: repartidores[0]._id,
            plan_adquirido: {
                plan_id: planes[0]._id,
                nombre_plan: planes[0].nombre_plan,
                calorias_diarias: planes[0].calorias_diarias,
                precio_historico: planes[0].precio_mensual
            },
            detalles: [
                {
                    platillo_id: platillos[0]._id,
                    nombre_platillo: platillos[0].nombre,
                    cantidad: 1,
                    precio_unitario: platillos[0].precio,
                    subtotal: platillos[0].precio
                }
            ],
            total: 8500
        }
    ]);
    console.log('✅ 1 Pedido inicial creado');
    console.log('🎉 ¡Base de datos en MongoDB Atlas 100% lista!');
    process.exit(0);
}

poblar().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

