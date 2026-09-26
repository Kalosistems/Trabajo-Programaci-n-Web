const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Permite configurar la ruta de la base de datos por variable de entorno (clave para Railway Volumes)
// Si existe DB_PATH (ej. en Railway: /app/data/nutridelivery.db), la usa; sino usa la ruta local
const defaultLocalDb = path.resolve(__dirname, '../../nutridelivery.db');
const dbPath = process.env.DB_PATH || defaultLocalDb;

// Asegurar que la carpeta exista si se usa una ruta externa
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (error) => {
    if (error) {
        console.error('Error conectando a SQLite:', error.message);
    } else {
        console.log(`¡Conexión exitosa a la Base de Datos SQLite en: ${dbPath}!`);

        // Inicializar tablas base
        db.serialize(() => {
            // Habilitar claves foráneas
            db.run('PRAGMA foreign_keys = ON');

            // 1. Tabla Cliente
            db.run(`CREATE TABLE IF NOT EXISTS Cliente (
                Id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
                Nombre TEXT NOT NULL,
                Correo TEXT UNIQUE NOT NULL,
                Password TEXT NOT NULL,
                Peso REAL,
                Altura REAL,
                Edad INTEGER,
                Genero TEXT
            )`);

            // 2. Tabla PlanNutricional
            db.run(`CREATE TABLE IF NOT EXISTS PlanNutricional (
                Id_plan INTEGER PRIMARY KEY AUTOINCREMENT,
                NombrePlan TEXT NOT NULL,
                CaloriasDiarias INTEGER,
                Objetivo TEXT,
                PrecioMensual REAL
            )`);

            // 3. Tabla Pedido
            db.run(`CREATE TABLE IF NOT EXISTS Pedido (
                Id_pedido INTEGER PRIMARY KEY AUTOINCREMENT,
                Id_cliente INTEGER NOT NULL,
                Id_plan INTEGER NOT NULL,
                Fecha TEXT DEFAULT (datetime('now','localtime')),
                Estado TEXT DEFAULT 'Pendiente',
                Total REAL,
                FOREIGN KEY(Id_cliente) REFERENCES Cliente(Id_cliente),
                FOREIGN KEY(Id_plan) REFERENCES PlanNutricional(Id_plan)
            )`);

            // Insertar datos iniciales si no existen
            db.run(`INSERT OR IGNORE INTO Cliente (Id_cliente, Nombre, Correo, Password, Peso, Altura, Edad, Genero) 
                    VALUES (1, 'Andrea Gomez', 'andrea@mail.com', 'secreta123', 68.5, 1.65, 28, 'Femenino')`);

            db.run(`INSERT OR IGNORE INTO PlanNutricional (Id_plan, NombrePlan, CaloriasDiarias, Objetivo, PrecioMensual)
                    VALUES 
                    (1, 'Definición Muscular', 1800, 'Pérdida de grasa y tonificación', 49.99),
                    (2, 'Volumen Limpio', 2600, 'Ganancia de masa muscular magra', 59.99),
                    (3, 'Salud y Vitalidad', 2000, 'Mantenimiento y nutrición balanceada', 39.99)`);

            db.run(`INSERT OR IGNORE INTO Pedido (Id_pedido, Id_cliente, Id_plan, Fecha, Estado, Total)
                    VALUES (1, 1, 1, datetime('now','localtime'), 'Entregado', 49.99)`);
        });
    }
});

module.exports = db;

