const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta hacia la base de datos local
const dbPath = path.resolve(__dirname, '../../nutridelivery.db');

const db = new sqlite3.Database(dbPath, (error) => {
    if (error) {
        console.error('Error conectando a SQLite:', error.message);
    } else {
        console.log('¡Conexión exitosa a la Base de Datos SQLite!');

        // Crear la tabla automáticamente si no existe
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS Cliente (
                Id_cliente INTEGER PRIMARY KEY,
                Nombre TEXT,
                Correo TEXT,
                Password TEXT,
                Peso REAL,
                Altura REAL,
                Edad INTEGER,
                Genero TEXT
            )`);

            // Insertar usuario semilla de prueba (solo si no existe)
            const insert = `INSERT OR IGNORE INTO Cliente (Id_cliente, Nombre, Correo, Password, Peso, Altura, Edad, Genero) 
                            VALUES (1, 'Andrea Gomez', 'andrea@mail.com', 'secreta123', 68.5, 1.65, 28, 'Femenino')`;
            db.run(insert);
        });
    }
});

module.exports = db;
