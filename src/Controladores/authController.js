/**
 * CONTROLADOR DE AUTENTICACIÓN NoSQL (ETAPA 2 - KALO)
 * Identifica el rol del usuario (Cliente, Restaurante, Repartidor)
 * en MongoDB Atlas y responde con la información requerida por el Frontend.
 */

const Usuario = require('../Modelos/mongo/Usuario');
const Restaurante = require('../Modelos/mongo/Restaurante');
const Repartidor = require('../Modelos/mongo/Repartidor');

exports.login = async (req, res) => {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({
            exito: false,
            mensaje: 'Por favor, ingresa tu correo y contraseña.'
        });
    }

    try {
        const correoNormalizado = correo.trim().toLowerCase();

        // 1. Buscar en Colección Usuario (Cliente)
        const cliente = await Usuario.findOne({ correo: correoNormalizado });
        if (cliente) {
            return res.status(200).json({
                exito: true,
                mensaje: `¡Bienvenido(a) a Kalo, ${cliente.nombre}!`,
                usuario: {
                    id: cliente._id,
                    nombre: cliente.nombre,
                    correo: cliente.correo,
                    telefono: cliente.telefono,
                    rol: 'cliente',
                    perfil_biometrico: cliente.perfil_biometrico
                }
            });
        }

        // 2. Buscar en Colección Restaurante
        const restaurante = await Restaurante.findOne({ correo: correoNormalizado });
        if (restaurante) {
            return res.status(200).json({
                exito: true,
                mensaje: `¡Sesión iniciada como Restaurante: ${restaurante.nombre}!`,
                usuario: {
                    id: restaurante._id,
                    nombre: restaurante.nombre,
                    correo: restaurante.correo,
                    telefono: restaurante.telefono,
                    rol: 'restaurante',
                    especialidad: restaurante.especialidad
                }
            });
        }

        // 3. Buscar en Colección Repartidor
        const repartidor = await Repartidor.findOne({ correo: correoNormalizado });
        if (repartidor) {
            return res.status(200).json({
                exito: true,
                mensaje: `¡Sesión iniciada como Repartidor: ${repartidor.nombre}!`,
                usuario: {
                    id: repartidor._id,
                    nombre: repartidor.nombre,
                    correo: repartidor.correo,
                    telefono: repartidor.telefono,
                    rol: 'repartidor',
                    vehiculo: repartidor.vehiculo,
                    estado: repartidor.estado
                }
            });
        }

        // Si no se encuentra en ninguna de las 3 colecciones
        return res.status(401).json({
            exito: false,
            mensaje: 'Credenciales inválidas. Correo o contraseña no registrados.'
        });

    } catch (error) {
        res.status(500).json({
            exito: false,
            mensaje: 'Error interno en el servidor de autenticación',
            detalle: error.message
        });
    }
};
