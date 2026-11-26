/**
 * CONTROLADOR DE AUTENTICACIÓN (dos bases de datos)
 * - PostgreSQL guarda la cuenta: correo, rol y hash bcrypt de la contraseña (tabla cuentas).
 * - MongoDB guarda el perfil de cada rol (usuarios, restaurantes, repartidores).
 * - Login: busca la cuenta por correo en PostgreSQL, compara con bcrypt.compare(), crea la sesión
 *   (tabla sesiones) y entrega el JWT en una cookie httpOnly. El token NUNCA va en el JSON.
 */
const bcrypt = require('bcryptjs');
const Usuario = require('../Modelos/mongo/Usuario');
const Restaurante = require('../Modelos/mongo/Restaurante');
const Repartidor = require('../Modelos/mongo/Repartidor');
const cuentas = require('../Modelos/sql/cuentas');
const { mongoose } = require('../config/mongo');
const { postgresListo } = require('../config/postgres');
const { firmarToken, ponerCookie, borrarCookie, EXPIRA } = require('../middleware/auth');
const { normalizarTelefono, telefonoValido, MENSAJE_TELEFONO } = require('../utils/telefono');
const { armarPerfil, perfilPublico } = require('../utils/perfil');

const COSTO_BCRYPT = 10;
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Misma regla que muestra el formulario: 8 caracteres, una mayúscula y un número
const CLAVE_VALIDA = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const MODELO = { cliente: Usuario, restaurante: Restaurante, repartidor: Repartidor };
// Hash de relleno: si el correo no existe se compara igual, para que la respuesta tarde lo mismo
const HASH_RELLENO = bcrypt.hashSync('kalo-relleno', COSTO_BCRYPT);

function error(res, http, codigo, mensaje) {
    return res.status(http).json({ exito: false, codigo, mensaje });
}

function basesListas(res) {
    if (mongoose.connection.readyState !== 1 || !postgresListo()) {
        error(res, 503, 'BD_NO_DISPONIBLE', 'La base de datos no está disponible en este momento. Intenta de nuevo en unos minutos.');
        return false;
    }
    return true;
}

// Datos públicos de cada tipo de cuenta (sin contraseña ni token)
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

// Crea la sesión en PostgreSQL y deja el token en la cookie httpOnly
async function abrirSesion(req, res, http, mensaje, cuenta, perfil) {
    const { token, jti, expiraEn } = firmarToken({ mongoId: cuenta.mongo_id, rol: cuenta.rol, nombre: perfil.nombre, cuentaId: cuenta.id });
    await cuentas.crearSesion({ jti, cuentaId: cuenta.id, expiraEn, ip: req.ip, agente: req.get('user-agent') });
    ponerCookie(req, res, token);
    return res.status(http).json({ exito: true, mensaje, expira_en: EXPIRA, usuario: datosPublicos(perfil, cuenta.rol) });
}

// POST /api/login
exports.login = async (req, res) => {
    if (!basesListas(res)) return;
    const { correo, password } = req.body || {};
    if (!correo || !password || typeof correo !== 'string' || typeof password !== 'string') {
        return error(res, 400, 'DATOS_FALTANTES', 'Ingresa tu correo y contraseña.');
    }
    try {
        const cuenta = await cuentas.buscarPorCorreo(correo.trim().toLowerCase());
        const coincide = await bcrypt.compare(password, cuenta ? cuenta.password_hash : HASH_RELLENO);
        if (!cuenta || !coincide || !cuenta.activo) {
            await cuentas.registrarAcceso(cuenta ? cuenta.id : null, false, req.ip);
            // Mismo mensaje si el correo no existe o la clave es incorrecta: no revela qué correos existen
            return error(res, 401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
        }
        const perfil = await MODELO[cuenta.rol].findById(cuenta.mongo_id);
        if (!perfil) return error(res, 401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
        await cuentas.registrarAcceso(cuenta.id, true, req.ip);
        return abrirSesion(req, res, 200, `¡Bienvenido(a) a Kalo, ${perfil.nombre}!`, cuenta, perfil);
    } catch (e) {
        console.error('Error en login:', e);
        return error(res, 500, 'ERROR_INTERNO', 'No pudimos iniciar sesión. Intenta de nuevo.');
    }
};

// POST /api/logout  → revoca la sesión en PostgreSQL y borra la cookie
exports.logout = async (req, res) => {
    try {
        await cuentas.revocarSesion(req.usuario.jti);
        borrarCookie(req, res);
        res.status(200).json({ exito: true, mensaje: 'Cerraste sesión.' });
    } catch (e) {
        console.error('Error al cerrar sesión:', e);
        error(res, 500, 'ERROR_INTERNO', 'No pudimos cerrar la sesión.');
    }
};

// GET /api/sesion  → el frontend la consulta al abrir la app para saber quién está conectado
exports.sesionActual = async (req, res) => {
    try {
        const perfil = await MODELO[req.usuario.rol].findById(req.usuario.id);
        if (!perfil) { borrarCookie(req, res); return error(res, 401, 'SESION_CERRADA', 'Tu cuenta ya no existe.'); }
        res.status(200).json({ exito: true, usuario: datosPublicos(perfil, req.usuario.rol) });
    } catch (e) {
        console.error('Error al leer la sesión:', e);
        error(res, 500, 'ERROR_INTERNO', 'No pudimos leer tu sesión.');
    }
};

// POST /api/registro
exports.registro = async (req, res) => {
    if (!basesListas(res)) return;
    let perfilCreado = null;
    try {
        const {
            rol = 'cliente', nombre, correo, password,
            peso, altura, edad, genero, nivel_actividad, objetivo,
            especialidad, direccion, telefono, vehiculo
        } = req.body || {};

        if (!nombre || !correo || !password) {
            return error(res, 400, 'DATOS_FALTANTES', 'El nombre, correo y contraseña son obligatorios.');
        }
        if (!MODELO[rol]) {
            return error(res, 422, 'ROL_INVALIDO', 'El rol debe ser cliente, restaurante o repartidor.');
        }
        const correoNormalizado = String(correo).trim().toLowerCase();
        if (!CORREO_VALIDO.test(correoNormalizado) || correoNormalizado.length > 254) {
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

        // El correo es único para las tres cuentas (columna UNIQUE en PostgreSQL)
        if (await cuentas.existeCorreo(correoNormalizado)) {
            return error(res, 409, 'CORREO_REGISTRADO', 'Ya existe una cuenta registrada con este correo.');
        }

        // 1) Perfil en MongoDB
        if (rol === 'restaurante') {
            if (!especialidad || !direccion) {
                return error(res, 400, 'DATOS_FALTANTES', 'Ingresa la especialidad y la dirección del restaurante.');
            }
            perfilCreado = await Restaurante.create({
                nombre: String(nombre).trim(), correo: correoNormalizado,
                especialidad: String(especialidad).trim(), direccion: String(direccion).trim(),
                telefono: telefonoNormalizado, calificacion_promedio: 5.0
            });
        } else if (rol === 'repartidor') {
            perfilCreado = await Repartidor.create({
                nombre: String(nombre).trim(), correo: correoNormalizado,
                telefono: telefonoNormalizado, vehiculo: vehiculo || 'Motocicleta', estado: 'Disponible', calificacion: 5.0
            });
        } else {
            // IMC (RF-02) y meta calórica con Mifflin-St Jeor (RF-03); datos de salud cifrados (RNF-02)
            const { perfil, error: errorPerfil } = armarPerfil({ peso, altura, edad, genero, nivel_actividad, objetivo });
            if (errorPerfil) return error(res, 422, 'BIOMETRIA_INVALIDA', errorPerfil);
            perfilCreado = await Usuario.create({
                nombre: String(nombre).trim(), correo: correoNormalizado, telefono: telefonoNormalizado, perfil_biometrico: perfil
            });
        }

        // 2) Cuenta en PostgreSQL con el hash bcrypt (si falla, se deshace el perfil de MongoDB)
        const password_hash = await bcrypt.hash(String(password), COSTO_BCRYPT);
        const cuenta = await cuentas.crearCuenta({ mongo_id: perfilCreado._id, rol, correo: correoNormalizado, password_hash });
        await cuentas.registrarAcceso(cuenta.id, true, req.ip);
        const mensaje = { cliente: '¡Cuenta creada!', restaurante: '¡Restaurante registrado!', repartidor: '¡Repartidor registrado!' }[rol];
        return abrirSesion(req, res, 201, mensaje, cuenta, perfilCreado);
    } catch (e) {
        if (perfilCreado) await perfilCreado.deleteOne().catch(() => {});
        if (e.code === 11000 || e.code === '23505') {
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
