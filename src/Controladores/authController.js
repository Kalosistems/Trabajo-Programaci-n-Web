/**
 * CONTROLADOR DE AUTENTICACIÓN (Etapa 2 · MongoDB Atlas)
 * - Registro: guarda la contraseña como hash bcrypt (nunca en texto plano).
 * - Login: busca la cuenta por correo en usuarios, restaurantes y repartidores,
 *   compara la contraseña con bcrypt.compare() y entrega un token JWT con el rol.
 */
const bcrypt = require('bcryptjs');
const Usuario = require('../Modelos/mongo/Usuario');
const Restaurante = require('../Modelos/mongo/Restaurante');
const Repartidor = require('../Modelos/mongo/Repartidor');
const { mongoose } = require('../config/mongo');
const { firmarToken, EXPIRA } = require('../middleware/auth');
const { normalizarTelefono, telefonoValido, MENSAJE_TELEFONO } = require('../utils/telefono');
const { armarPerfil, perfilPublico } = require('../utils/perfil');

const COSTO_BCRYPT = 10;
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Misma regla que muestra el formulario: 8 caracteres, una mayúscula y un número
const CLAVE_VALIDA = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function error(res, http, codigo, mensaje) {
    return res.status(http).json({ exito: false, codigo, mensaje });
}

function verificarConexionAtlas(res) {
    if (mongoose.connection.readyState !== 1) {
        error(res, 503, 'BD_NO_DISPONIBLE', 'La base de datos no está disponible en este momento. Intenta de nuevo en unos minutos.');
        return false;
    }
    return true;
}

// Datos públicos de cada tipo de cuenta (sin password_hash)
function datosPublicos(doc, rol) {
    const base = { id: doc._id, nombre: doc.nombre, correo: doc.correo, telefono: doc.telefono, rol };
    if (rol === 'cliente') return { ...base, perfil_biometrico: perfilPublico(doc), plan_activo: doc.plan_activo || null };
    if (rol === 'restaurante') {
        return {
            ...base, direccion: doc.direccion, especialidad: doc.especialidad, calificacion_promedio: doc.calificacion_promedio,
            indice_transparencia: doc.indice_transparencia, total_evaluaciones: doc.total_evaluaciones
        };
    }
    return { ...base, vehiculo: doc.vehiculo, estado: doc.estado, calificacion: doc.calificacion };
}

function respuestaSesion(res, http, mensaje, usuario) {
    return res.status(http).json({
        exito: true,
        mensaje,
        token: firmarToken(usuario),
        expira_en: EXPIRA,
        usuario
    });
}

// POST /api/login
exports.login = async (req, res) => {
    if (!verificarConexionAtlas(res)) return;

    const { correo, password } = req.body || {};
    if (!correo || !password) {
        return error(res, 400, 'DATOS_FALTANTES', 'Ingresa tu correo y contraseña.');
    }

    try {
        const correoNormalizado = String(correo).trim().toLowerCase();

        // Se busca SOLO por correo; la contraseña nunca va en el filtro
        const candidatos = [
            ['cliente', Usuario],
            ['restaurante', Restaurante],
            ['repartidor', Repartidor]
        ];
        for (const [rol, Modelo] of candidatos) {
            const cuenta = await Modelo.findOne({ correo: correoNormalizado }).select('+password_hash');
            if (!cuenta) continue;

            const coincide = await bcrypt.compare(String(password), cuenta.password_hash || '');
            if (!coincide) break; // mismo mensaje que si el correo no existiera

            const usuario = datosPublicos(cuenta, rol);
            return respuestaSesion(res, 200, `¡Bienvenido(a) a Kalo, ${cuenta.nombre}!`, usuario);
        }

        // Correo inexistente o contraseña incorrecta: el mismo mensaje, para no revelar qué correos existen
        return error(res, 401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
    } catch (e) {
        console.error('Error en login:', e);
        return error(res, 500, 'ERROR_INTERNO', 'No pudimos iniciar sesión. Intenta de nuevo.');
    }
};

// POST /api/registro
exports.registro = async (req, res) => {
    if (!verificarConexionAtlas(res)) return;

    try {
        const {
            rol = 'cliente', nombre, correo, password,
            peso, altura, edad, genero, nivel_actividad, objetivo,
            especialidad, direccion, telefono, vehiculo
        } = req.body || {};

        if (!nombre || !correo || !password) {
            return error(res, 400, 'DATOS_FALTANTES', 'El nombre, correo y contraseña son obligatorios.');
        }
        if (!['cliente', 'restaurante', 'repartidor'].includes(rol)) {
            return error(res, 422, 'ROL_INVALIDO', 'El rol debe ser cliente, restaurante o repartidor.');
        }
        const correoNormalizado = String(correo).trim().toLowerCase();
        if (!CORREO_VALIDO.test(correoNormalizado)) {
            return error(res, 422, 'CORREO_INVALIDO', 'El correo no tiene un formato válido.');
        }
        if (!CLAVE_VALIDA.test(String(password))) {
            return error(res, 422, 'CLAVE_DEBIL', 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.');
        }
        if (rol === 'repartidor' && !telefono) {
            return error(res, 400, 'DATOS_FALTANTES', 'Ingresa un teléfono de contacto.');
        }
        if (telefono && !telefonoValido(telefono)) {
            return error(res, 422, 'TELEFONO_INVALIDO', MENSAJE_TELEFONO);
        }
        const telefonoNormalizado = telefono ? normalizarTelefono(telefono) : undefined;

        // El correo es único entre las tres colecciones (sirve para iniciar sesión)
        const [c, r, p] = await Promise.all([
            Usuario.exists({ correo: correoNormalizado }),
            Restaurante.exists({ correo: correoNormalizado }),
            Repartidor.exists({ correo: correoNormalizado })
        ]);
        if (c || r || p) {
            return error(res, 409, 'CORREO_REGISTRADO', 'Ya existe una cuenta registrada con este correo.');
        }

        // Hash bcrypt con costo 10: se guarda '$2a$10$...' y nunca la contraseña
        const password_hash = await bcrypt.hash(String(password), COSTO_BCRYPT);

        if (rol === 'restaurante') {
            if (!especialidad || !direccion) {
                return error(res, 400, 'DATOS_FALTANTES', 'Ingresa la especialidad y la dirección del restaurante.');
            }
            const nuevo = await Restaurante.create({
                nombre: nombre.trim(), correo: correoNormalizado, password_hash,
                especialidad: especialidad.trim(), direccion: direccion.trim(),
                telefono: telefonoNormalizado,
                calificacion_promedio: 5.0
            });
            return respuestaSesion(res, 201, '¡Restaurante registrado!', datosPublicos(nuevo, 'restaurante'));
        }

        if (rol === 'repartidor') {
            const nuevo = await Repartidor.create({
                nombre: nombre.trim(), correo: correoNormalizado, password_hash,
                telefono: telefonoNormalizado, vehiculo: vehiculo || 'Motocicleta',
                estado: 'Disponible', calificacion: 5.0
            });
            return respuestaSesion(res, 201, '¡Repartidor registrado!', datosPublicos(nuevo, 'repartidor'));
        }

        // Cliente con perfil biométrico: IMC (RF-02) y meta calórica con Mifflin-St Jeor (RF-03).
        // Los datos de salud quedan cifrados en la base (RNF-02).
        const { perfil, error: errorPerfil } = armarPerfil({ peso, altura, edad, genero, nivel_actividad, objetivo });
        if (errorPerfil) return error(res, 422, 'BIOMETRIA_INVALIDA', errorPerfil);

        const nuevo = await Usuario.create({
            nombre: nombre.trim(), correo: correoNormalizado, password_hash,
            telefono: telefonoNormalizado,
            perfil_biometrico: perfil
        });
        return respuestaSesion(res, 201, '¡Cuenta creada!', datosPublicos(nuevo, 'cliente'));
    } catch (e) {
        if (e.code === 11000) {
            return error(res, 409, 'CORREO_REGISTRADO', 'Ya existe una cuenta registrada con este correo.');
        }
        if (e.name === 'ValidationError') {
            return error(res, 422, 'DATOS_INVALIDOS', Object.values(e.errors).map(x => x.message).join(' '));
        }
        console.error('Error en registro:', e);
        return error(res, 500, 'ERROR_INTERNO', 'No pudimos crear la cuenta. Intenta de nuevo.');
    }
};

exports.datosPublicos = datosPublicos;
