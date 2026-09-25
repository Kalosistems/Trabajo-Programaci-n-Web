const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(express.json()); 
app.use(cors()); 
app.use(express.static('public'));

// 1. Conexión a SQLite (Crea el archivo nutridelivery.db automáticamente)
const db = new sqlite3.Database('./nutridelivery.db', (error) => {
    if (error) {
        console.error('Error conectando a SQLite:', error.message);
    } else {
        console.log('¡Conexión exitosa a la Base de Datos SQLite!');
        
        // 2. Crear la tabla automáticamente si no existe
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

            // 3. Insertar el usuario de prueba (solo si no existe)
            const insert = `INSERT OR IGNORE INTO Cliente (Id_cliente, Nombre, Correo, Password, Peso, Altura, Edad, Genero) 
                            VALUES (1, 'Andrea Gomez', 'andrea@mail.com', 'secreta123', 68.5, 1.65, 28, 'Femenino')`;
            db.run(insert);
        });
    }
});

// Ruta (API) que recibe los datos del Frontend[cite: 3]
app.post('/api/login', (req, res) => {
    const { correo, password } = req.body;

    // El Backend consulta a la Base de Datos buscando el correo y clave[cite: 3]
    const consulta = 'SELECT * FROM Cliente WHERE Correo = ? AND Password = ?';
    
    db.all(consulta, [correo, password], (error, resultados) => {
        if (error) {
            return res.status(500).json({ mensaje: 'Error en la base de datos' });
        }

        if (resultados.length > 0) {
            res.json({ mensaje: '¡Login exitoso! Bienvenido a NutriDelivery.' });
        } else {
            res.json({ mensaje: 'Correo o contraseña incorrectos.' });
        }
    });
});

app.listen(3000, () => {
    console.log('Servidor Backend corriendo en http://localhost:3000');
});