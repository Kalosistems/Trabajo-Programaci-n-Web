const Cliente = require('../Modelos/Cliente');

exports.login = async (req, res) => {
    const { correo, password } = req.body;

    try {
        const resultados = await Cliente.buscarPorCredenciales(correo, password);

        if (resultados.length > 0) {
            res.json({ mensaje: '¡Login exitoso! Bienvenido a NutriDelivery.' });
        } else {
            res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
        }
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en la base de datos', detalle: error.message });
    }
};

