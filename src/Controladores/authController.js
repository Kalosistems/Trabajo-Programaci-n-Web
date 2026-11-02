/**
 * CONTROLADOR DE AUTENTICACIÓN NoSQL (ETAPA 2 - KALO)
 * Identifica el rol del usuario (Cliente, Restaurante, Repartidor)
 * en MongoDB Atlas y responde con la información requerida por el Frontend.
 */

const Usuario = require('../Modelos/mongo/Usuario');
const Restaurante = require('../Modelos/mongo/Restaurante');
const Repartidor = require('../Modelos/mongo/Repartidor');
const { mongoose } = require('../config/mongo');

function verificarConexionAtlas(res) {
    if (mongoose.connection.readyState !== 1) {
        res.status(503).json({
            exito: false,
            mensaje: 'MongoDB Atlas no está conectado. Revisa que el servidor se haya reiniciado con el archivo .env y que en Atlas esté habilitada la IP 0.0.0.0/0 en Network Access.'
        });
        return false;
    }
    return true;
}

// 1. INICIAR SESIÓN
exports.login = async (req, res) => {
    if (!verificarConexionAtlas(res)) return;

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
                    especialidad: restaurante.especialidad,
                    calificacion_promedio: restaurante.calificacion_promedio || 4.9
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
            mensaje: 'Correo o contraseña incorrectos'
        });

    } catch (error) {
        res.status(500).json({
            exito: false,
            mensaje: 'Error interno en el servidor de autenticación',
            detalle: error.message
        });
    }
};

// 2. REGISTRO EN 2 PASOS (CLIENTE / RESTAURANTE / REPARTIDOR)
exports.registro = async (req, res) => {
    if (!verificarConexionAtlas(res)) return;

    try {
        const { rol, nombre, correo, password, peso, altura, edad, genero } = req.body;

        if (!nombre || !correo || !password) {
            return res.status(400).json({
                exito: false,
                mensaje: 'El nombre, correo y contraseña son obligatorios.'
            });
        }

        const correoNormalizado = correo.trim().toLowerCase();

        // Verificar existencia previa
        const existeCliente = await Usuario.findOne({ correo: correoNormalizado });
        const existeRest = await Restaurante.findOne({ correo: correoNormalizado });
        const existeRepart = await Repartidor.findOne({ correo: correoNormalizado });

        if (existeCliente || existeRest || existeRepart) {
            return res.status(400).json({
                exito: false,
                mensaje: 'Ya existe una cuenta registrada con este correo electrónico.'
            });
        }

        if (rol === 'restaurante') {
            const nuevoRest = await Restaurante.create({
                nombre: nombre.trim(),
                correo: correoNormalizado,
                password_hash: password,
                especialidad: 'Comida Nutritiva y Saludable',
                direccion: 'Av. Libertad 450, Viña del Mar'
            });

            return res.status(201).json({
                exito: true,
                mensaje: '¡Restaurante registrado exitosamente en MongoDB Atlas!',
                usuario: {
                    id: nuevoRest._id,
                    nombre: nuevoRest.nombre,
                    correo: nuevoRest.correo,
                    rol: 'restaurante'
                }
            });
        }

        if (rol === 'repartidor') {
            const nuevoRepart = await Repartidor.create({
                nombre: nombre.trim(),
                correo: correoNormalizado,
                password_hash: password,
                telefono: '+56900000000',
                vehiculo: 'Motocicleta'
            });

            return res.status(201).json({
                exito: true,
                mensaje: '¡Repartidor registrado exitosamente en MongoDB Atlas!',
                usuario: {
                    id: nuevoRepart._id,
                    nombre: nuevoRepart.nombre,
                    correo: nuevoRepart.correo,
                    rol: 'repartidor'
                }
            });
        }

        // Por defecto: Rol Cliente con Perfil Biométrico
        const pesoKg = parseFloat(peso) || 68.5;
        const alturaM = parseFloat(altura) || 1.65;
        const imcCalc = parseFloat((pesoKg / (alturaM * alturaM)).toFixed(1));
        
        let metaCalorica = 1800;
        if (genero === 'Masculino') metaCalorica = 2200;
        else if (genero === 'Femenino') metaCalorica = 1800;

        const nuevoUsuario = await Usuario.create({
            nombre: nombre.trim(),
            correo: correoNormalizado,
            password_hash: password,
            perfil_biometrico: {
                peso_kg: pesoKg,
                altura_m: alturaM,
                edad: parseInt(edad) || 28,
                genero: genero || 'Femenino',
                imc: imcCalc,
                meta_calorica_diaria: metaCalorica,
                objetivo_salud: 'Nutrición balanceada'
            }
        });

        console.log(`✅ Nuevo usuario creado en Atlas: ${nuevoUsuario.nombre} (${nuevoUsuario.correo})`);

        res.status(201).json({
            exito: true,
            mensaje: '¡Cuenta creada exitosamente en MongoDB Atlas!',
            usuario: {
                id: nuevoUsuario._id,
                nombre: nuevoUsuario.nombre,
                correo: nuevoUsuario.correo,
                rol: 'cliente',
                perfil_biometrico: nuevoUsuario.perfil_biometrico
            }
        });
    } catch (error) {
        console.error('Error al registrar usuario en Atlas:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error al registrar usuario en Atlas: ' + error.message
        });
    }
};
