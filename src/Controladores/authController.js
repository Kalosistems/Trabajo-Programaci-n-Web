const db = require('../config/db');

exports.login = (req, res) => {
    const { correo, password } = req.body;

    // Consulta buscando el correo y clave
    const consulta = 'SELECT * FROM Cliente WHERE Correo = ? AND Password = ?';

    db.all(consulta, [correo, password], (error, resultados) => {
        if (error) {
            return res.status(500).json({ mensaje: 'Error en la base de datos' });
        }

        if (resultados.length > 0) {
            res.json({ mensaje: '¡Login exitoso! Bienvenido a NutriDelivery.' });
        } else {
            res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
        }
    });
};
