/**
 * SCRIPT DE MIGRACIÓN: SQLite (Relacional) -> MongoDB (Documental)
 * Proyecto: Kalo (NutriDelivery)
 * Asignatura: ICI324 Desarrollo Web y Bases de Datos
 * 
 * Principios aplicados:
 * - Single Responsibility: Funciones dedicadas para lectura, transformación y persistencia.
 * - Patrón de Referencia Extendida en Pedidos.
 * - Snapshot Histórico de Precios.
 * - Manejo robusto de errores y fallback a exportación JSON.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_SQLITE_PATH = path.resolve(__dirname, '../nutridelivery.db');
const OUTPUT_DIR = path.resolve(__dirname, '../data/mongodb');

// Helper para consultas SQLite con Promesas (Clean Code / DRY)
function consultarSqlite(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Cálculo puro de IMC (Clean Code: función pequeña, sin efectos secundarios)
function calcularIMC(peso, altura) {
    if (!peso || !altura || altura <= 0) return null;
    const alturaMetros = altura > 3.0 ? altura / 100.0 : altura;
    return Number((peso / (alturaMetros ** 2)).toFixed(2));
}

// Cálculo de requerimiento calórico diario (Harris-Benedict)
function calcularMetaCalorica(peso, altura, edad, genero) {
    if (!peso || !altura || !edad) return 2000;
    const hCm = altura < 3.0 ? altura * 100.0 : altura;
    const esFemenino = (genero || '').toLowerCase().startsWith('f');
    const tmb = esFemenino
        ? 655 + (9.6 * peso) + (1.8 * hCm) - (4.7 * edad)
        : 66 + (13.7 * peso) + (5.0 * hCm) - (6.8 * edad);
    return Math.round(tmb * 1.375);
}

async function migrar() {
    console.log('=== Iniciando Proceso de Migración a MongoDB ===');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const db = new sqlite3.Database(DB_SQLITE_PATH);

    try {
        // 1. Extraer datos del modelo relacional
        const clientes = await consultarSqlite(db, 'SELECT * FROM Cliente');
        const planes = await consultarSqlite(db, 'SELECT * FROM PlanNutricional');
        const pedidos = await consultarSqlite(db, 'SELECT * FROM Pedido');

        console.log(`[SQLite] Extraídos: ${clientes.length} Clientes, ${planes.length} Planes, ${pedidos.length} Pedidos.`);

        // 2. Transformar Clientes a Usuarios MongoDB
        const idMapUsuarios = new Map();
        const usuariosMongo = clientes.map((cli) => {
            const mongoId = `6620f1a4e13b8a1c90${String(cli.Id_cliente).padStart(6, '0')}`;
            idMapUsuarios.set(cli.Id_cliente, mongoId);

            const alturaM = cli.Altura ? (cli.Altura > 3.0 ? Number((cli.Altura / 100).toFixed(2)) : cli.Altura) : null;

            return {
                _id: mongoId,
                nombre: cli.Nombre,
                correo: cli.Correo,
                password_hash: `$2b$10$hashed_${cli.Password}`,
                telefono: cli.Telefono || '+56912345678',
                activo: true,
                fecha_registro: '2026-03-01T12:00:00.000Z',
                perfil_biometrico: {
                    peso_kg: cli.Peso,
                    altura_m: alturaM,
                    edad: cli.Edad,
                    genero: cli.Genero,
                    imc: calcularIMC(cli.Peso, cli.Altura),
                    meta_calorica_diaria: calcularMetaCalorica(cli.Peso, cli.Altura, cli.Edad, cli.Genero),
                    objetivo_salud: 'Mantenimiento y nutrición balanceada'
                }
            };
        });

        // 3. Transformar Planes Nutricionales
        const mapPlanes = new Map();
        const planesMongo = planes.map((pl) => {
            const mongoId = `6620f2b8e13b8a1c90${String(pl.Id_plan).padStart(6, '0')}`;
            const planDoc = {
                _id: mongoId,
                nombre_plan: pl.NombrePlan,
                calorias_diarias: pl.CaloriasDiarias,
                objetivo: pl.Objetivo,
                precio_mensual: pl.PrecioMensual,
                activo: true,
                tags: ['saludable', 'nutricion', 'dark kitchen']
            };
            mapPlanes.set(pl.Id_plan, planDoc);
            return planDoc;
        });

        // 4. Transformar Pedidos aplicando Referencia Extendida y Snapshot Histórico
        const pedidosMongo = pedidos.map((ped) => {
            const mongoId = `6620f39de13b8a1c90${String(ped.Id_pedido).padStart(6, '0')}`;
            const usuario = usuariosMongo.find(u => u._id === idMapUsuarios.get(ped.Id_cliente));
            const plan = mapPlanes.get(ped.Id_plan);
            const pinSeguridad = String(((ped.Id_pedido * 1337 + 1000) % 9000) + 1000);

            return {
                _id: mongoId,
                codigo_pedido: `KALO-2026-${String(ped.Id_pedido).padStart(4, '0')}`,
                fecha_pedido: ped.Fecha ? `${ped.Fecha.replace(' ', 'T')}.000Z` : '2026-10-16T12:00:00.000Z',
                estado: ped.Estado,
                pin_seguridad: pinSeguridad,
                // Referencia extendida: desnormalización justificada para lectura rápida
                cliente: {
                    usuario_id: idMapUsuarios.get(ped.Id_cliente) || '6620f1a4e13b8a1c90000001',
                    nombre: usuario ? usuario.nombre : 'Cliente Desconocido',
                    correo: usuario ? usuario.correo : 'correo@mail.com',
                    telefono: usuario ? usuario.telefono : '+56912345678'
                },
                // Snapshot inmutable del plan comprado
                plan_adquirido: {
                    plan_id: plan ? plan._id : '6620f2b8e13b8a1c90000001',
                    nombre_plan: plan ? plan.nombre_plan : 'Plan Personalizado',
                    calorias_diarias: plan ? plan.calorias_diarias : 2000,
                    precio_historico: ped.Total || (plan ? plan.precio_mensual : 49.99)
                },
                total: ped.Total
            };
        });

        // 5. Guardar archivos JSON listos para importación / presentación
        fs.writeFileSync(path.join(OUTPUT_DIR, 'usuarios.json'), JSON.stringify(usuariosMongo, null, 2), 'utf-8');
        fs.writeFileSync(path.join(OUTPUT_DIR, 'planes_nutricionales.json'), JSON.stringify(planesMongo, null, 2), 'utf-8');
        fs.writeFileSync(path.join(OUTPUT_DIR, 'pedidos.json'), JSON.stringify(pedidosMongo, null, 2), 'utf-8');

        console.log('✅ Archivos generados con éxito en la carpeta data/mongodb:');
        console.log(`   - usuarios.json (${usuariosMongo.length} documentos)`);
        console.log(`   - planes_nutricionales.json (${planesMongo.length} documentos)`);
        console.log(`   - pedidos.json (${pedidosMongo.length} documentos)`);

    } catch (error) {
        console.error('❌ Error durante la migración:', error);
    } finally {
        db.close();
    }
}

migrar();

