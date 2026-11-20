/**
 * CONTROLADOR MONGODB (Etapa 2 · Kalo)
 * Todas las respuestas usan el mismo formato:
 *   éxito → { exito: true, ..., datos | pedido | platillo | usuario }
 *   error → { exito: false, codigo, mensaje }
 * Quién hace cada acción se toma del token (req.usuario), no del cuerpo de la solicitud.
 */
const crypto = require('crypto');
const Usuario = require('../Modelos/mongo/Usuario');
const PlanNutricional = require('../Modelos/mongo/PlanNutricional');
const Restaurante = require('../Modelos/mongo/Restaurante');
const Repartidor = require('../Modelos/mongo/Repartidor');
const Platillo = require('../Modelos/mongo/Platillo');
const Pedido = require('../Modelos/mongo/Pedido');
const { mongoose } = require('../config/mongo');
const { normalizarTelefono, telefonoValido, MENSAJE_TELEFONO } = require('../utils/telefono');

const COSTO_ENVIO = 1490;
const MAX_INTENTOS_PIN = 5;
const ESTADOS = ['Pendiente', 'Pagado', 'En Preparación', 'En Camino', 'Entregado', 'Cancelado'];
// Avances permitidos del pedido (el restaurante no puede saltar ni retroceder estados)
const SIGUIENTE = {
    'Pagado': ['En Preparación', 'Cancelado'],
    'En Preparación': ['En Camino', 'Cancelado'],
    'En Camino': [],
    'Entregado': [],
    'Cancelado': []
};

function error(res, http, codigo, mensaje) {
    return res.status(http).json({ exito: false, codigo, mensaje });
}

function falla(res, e, mensaje) {
    console.error(mensaje, e);
    if (e.name === 'ValidationError') {
        return error(res, 422, 'DATOS_INVALIDOS', Object.values(e.errors).map(x => x.message).join(' '));
    }
    if (e.name === 'CastError') return error(res, 400, 'ID_INVALIDO', 'El identificador enviado no es válido.');
    return error(res, 500, 'ERROR_INTERNO', mensaje);
}

function verificarConexion(res) {
    if (mongoose.connection.readyState !== 1) {
        error(res, 503, 'BD_NO_DISPONIBLE', 'La base de datos no está disponible en este momento. Intenta de nuevo en unos minutos.');
        return false;
    }
    return true;
}

const esId = (id) => mongoose.Types.ObjectId.isValid(id);
// Escapa el texto del buscador para usarlo en $regex sin que el usuario inyecte expresiones
const escaparRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pinAleatorio = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

// Quita el PIN de un pedido cuando quien consulta no es el cliente dueño
function ocultarPin(pedido, usuario) {
    const p = pedido.toObject ? pedido.toObject() : { ...pedido };
    const esDueno = usuario && usuario.rol === 'cliente' && String(p.cliente?.usuario_id) === String(usuario.id);
    if (!esDueno) delete p.pin_seguridad;
    delete p.intentos_pin;
    return p;
}

// ALGORITMO DE CÁLCULO DE TRANSPARENCIA KALO (50% base + opcionales hasta 100%)
function calcularIndiceTransparencia(datos) {
    let porcentaje = 50; // Base por nombre, precio y calorías
    if (datos.proteinas && parseFloat(datos.proteinas) > 0) porcentaje += 10;
    if (datos.carbos && parseFloat(datos.carbos) > 0) porcentaje += 10;
    if (datos.grasas && parseFloat(datos.grasas) > 0) porcentaje += 10;
    if (datos.peso_porcion && parseFloat(datos.peso_porcion) > 0) porcentaje += 10;
    if (datos.alergenos && String(datos.alergenos).trim().length > 3) porcentaje += 5;
    if (datos.ingredientes_limpios === true || datos.ingredientes_limpios === 'true') porcentaje += 5;
    if (Array.isArray(datos.ingredientes) && datos.ingredientes.length > 0) porcentaje += 10;
    return Math.min(porcentaje, 100);
}

// ─────────────────────────────────────────────────────────────────────
// CATÁLOGO (público)
// ─────────────────────────────────────────────────────────────────────

// GET /api/mongo/platillos?categoria=&busqueda=&maxCalorias=&minProteina=
exports.obtenerPlatillos = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { categoria, busqueda, maxCalorias, minProteina } = req.query;
        const filtro = { activo: true };
        if (categoria && categoria !== 'todas') filtro.categoria = String(categoria);
        if (busqueda) filtro.nombre = { $regex: escaparRegex(busqueda), $options: 'i' };
        if (maxCalorias !== undefined) {
            const n = parseInt(maxCalorias, 10);
            if (!(n > 0)) return error(res, 400, 'PARAMETRO_INVALIDO', 'maxCalorias debe ser un número mayor que 0.');
            filtro.calorias = { $lte: n };
        }
        if (minProteina !== undefined) {
            const n = parseFloat(minProteina);
            if (!(n >= 0)) return error(res, 400, 'PARAMETRO_INVALIDO', 'minProteina debe ser un número mayor o igual a 0.');
            filtro['macronutrientes.proteinas_g'] = { $gte: n };
        }

        const platillos = await Platillo.find(filtro)
            .populate('restaurante_id', 'nombre especialidad direccion')
            .sort({ indice_transparencia: -1, precio: 1 });
        res.status(200).json({
            exito: true,
            total: platillos.length,
            operacion: 'find()',
            descripcion: 'Platillos activos con calorías y macronutrientes',
            consultaMQL: `Platillo.find(${JSON.stringify(filtro)}).sort({ indice_transparencia: -1, precio: 1 })`,
            datos: platillos
        });
    } catch (e) {
        falla(res, e, 'Error al obtener los platillos');
    }
};

// GET /api/mongo/platillos-fit?maxCalorias=500  (operador $lte)
exports.obtenerPlatillosLigeros = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const limite = req.query.maxCalorias === undefined ? 500 : parseInt(req.query.maxCalorias, 10);
        if (!(limite > 0)) return error(res, 400, 'PARAMETRO_INVALIDO', 'maxCalorias debe ser un número mayor que 0.');
        const platillos = await Platillo.find({ calorias: { $lte: limite }, activo: true }).sort({ calorias: 1 });
        res.status(200).json({
            exito: true,
            total: platillos.length,
            operacion: 'find() con operador $lte',
            descripcion: `Platillos con un máximo de ${limite} kcal`,
            consultaMQL: `Platillo.find({ calorias: { $lte: ${limite} }, activo: true }).sort({ calorias: 1 })`,
            datos: platillos
        });
    } catch (e) {
        falla(res, e, 'Error al filtrar platillos por calorías');
    }
};

// GET /api/mongo/platillos-con-restaurante  (JOIN con $lookup)
exports.obtenerPlatillosConRestaurante = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const resultado = await Platillo.aggregate([
            { $match: { activo: true } },
            { $lookup: { from: 'restaurantes', localField: 'restaurante_id', foreignField: '_id', as: 'restaurante' } },
            { $unwind: '$restaurante' },
            {
                $project: {
                    nombre: 1, descripcion: 1, categoria: 1, imagen_url: 1, precio: 1, calorias: 1,
                    indice_transparencia: 1, peso_porcion_g: 1, alergenos: 1, ingredientes_limpios: 1,
                    macronutrientes: 1, ingredientes: 1,
                    'restaurante.nombre': 1, 'restaurante.especialidad': 1,
                    'restaurante.direccion': 1, 'restaurante.telefono': 1
                }
            }
        ]);
        res.status(200).json({
            exito: true,
            total: resultado.length,
            operacion: 'aggregate() con $lookup (JOIN NoSQL)',
            descripcion: 'Cada platillo junto con los datos de su restaurante',
            consultaMQL: 'Platillo.aggregate([ { $match: { activo: true } }, { $lookup: { from: "restaurantes", localField: "restaurante_id", foreignField: "_id", as: "restaurante" } }, { $unwind: "$restaurante" } ])',
            datos: resultado
        });
    } catch (e) {
        falla(res, e, 'Error al ejecutar el JOIN ($lookup)');
    }
};

// GET /api/mongo/planes?precioMin=20  (WHERE + ORDER BY)
exports.obtenerPlanes = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const filtro = { activo: true };
        if (req.query.precioMin !== undefined) {
            const n = parseFloat(req.query.precioMin);
            if (!(n >= 0)) return error(res, 400, 'PARAMETRO_INVALIDO', 'precioMin debe ser un número mayor o igual a 0.');
            filtro.precio_mensual = { $gt: n };
        }
        const planes = await PlanNutricional.find(filtro).sort({ precio_mensual: -1 });
        res.status(200).json({
            exito: true,
            total: planes.length,
            operacion: 'find() con $gt y sort()',
            consultaMQL: `PlanNutricional.find(${JSON.stringify(filtro)}).sort({ precio_mensual: -1 })`,
            datos: planes
        });
    } catch (e) {
        falla(res, e, 'Error al obtener los planes');
    }
};

// ─────────────────────────────────────────────────────────────────────
// CONSULTAS CON SESIÓN
// ─────────────────────────────────────────────────────────────────────

// GET /api/mongo/estadisticas  (GROUP BY con $group)
exports.obtenerEstadisticasBiometricas = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const datos = await Usuario.aggregate([
            {
                $group: {
                    _id: '$perfil_biometrico.genero',
                    totalUsuarios: { $sum: 1 },
                    pesoPromedio: { $avg: '$perfil_biometrico.peso_kg' },
                    alturaPromedio: { $avg: '$perfil_biometrico.altura_m' },
                    imcPromedio: { $avg: '$perfil_biometrico.imc' },
                    metaCaloricaPromedio: { $avg: '$perfil_biometrico.meta_calorica_diaria' }
                }
            },
            {
                $project: {
                    genero: '$_id', _id: 0, totalUsuarios: 1,
                    pesoPromedio: { $round: ['$pesoPromedio', 1] },
                    alturaPromedio: { $round: ['$alturaPromedio', 2] },
                    imcPromedio: { $round: ['$imcPromedio', 1] },
                    metaCaloricaPromedio: { $round: ['$metaCaloricaPromedio', 0] }
                }
            },
            { $sort: { totalUsuarios: -1 } }
        ]);
        res.status(200).json({
            exito: true,
            operacion: 'aggregate() con $group (GROUP BY NoSQL)',
            descripcion: 'Cantidad de clientes y promedios biométricos por género (datos agregados, sin nombres)',
            consultaMQL: 'Usuario.aggregate([ { $group: { _id: "$perfil_biometrico.genero", totalUsuarios: { $sum: 1 }, imcPromedio: { $avg: "$perfil_biometrico.imc" } } }, { $sort: { totalUsuarios: -1 } } ])',
            datos
        });
    } catch (e) {
        falla(res, e, 'Error en el cálculo de estadísticas');
    }
};

// GET /api/mongo/usuarios  (equivale a la consulta SQL 1, con proyección)
exports.obtenerUsuarios = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const proyeccion = { nombre: 1, fecha_registro: 1, 'perfil_biometrico.genero': 1, 'perfil_biometrico.imc': 1, 'perfil_biometrico.meta_calorica_diaria': 1 };
        const datos = await Usuario.find({ activo: true }, proyeccion).sort({ nombre: 1 });
        res.status(200).json({
            exito: true,
            total: datos.length,
            operacion: 'find() con proyección',
            descripcion: 'Clientes activos, sin correo, teléfono ni contraseña',
            consultaMQL: `Usuario.find({ activo: true }, ${JSON.stringify(proyeccion)}).sort({ nombre: 1 })`,
            datos
        });
    } catch (e) {
        falla(res, e, 'Error al obtener los clientes');
    }
};

// GET /api/mongo/usuarios-pedidos  (LEFT JOIN: clientes con o sin pedidos)
exports.obtenerUsuariosConPedidos = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const datos = await Usuario.aggregate([
            { $lookup: { from: 'pedidos', localField: '_id', foreignField: 'cliente.usuario_id', as: 'pedidos' } },
            {
                $project: {
                    _id: 0, nombre: 1,
                    cantidad_pedidos: { $size: '$pedidos' },
                    gasto_total: { $sum: '$pedidos.total' }
                }
            },
            { $sort: { cantidad_pedidos: -1, nombre: 1 } }
        ]);
        res.status(200).json({
            exito: true,
            total: datos.length,
            operacion: 'aggregate() con $lookup + $size (LEFT JOIN)',
            descripcion: 'Todos los clientes con su cantidad de pedidos, incluso los que tienen 0',
            consultaMQL: 'Usuario.aggregate([ { $lookup: { from: "pedidos", localField: "_id", foreignField: "cliente.usuario_id", as: "pedidos" } }, { $project: { nombre: 1, cantidad_pedidos: { $size: "$pedidos" }, gasto_total: { $sum: "$pedidos.total" } } } ])',
            datos
        });
    } catch (e) {
        falla(res, e, 'Error al cruzar clientes y pedidos');
    }
};

// GET /api/mongo/pedidos  (cada rol ve solo sus pedidos)
exports.obtenerPedidos = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { rol, id } = req.usuario;
        let filtro;
        if (rol === 'cliente') filtro = { 'cliente.usuario_id': id };
        else if (rol === 'restaurante') filtro = { restaurante_id: id };
        else filtro = { $or: [{ repartidor_id: id }, { repartidor_id: null, estado: { $in: ['En Preparación', 'En Camino'] } }] };

        if (req.query.estado) {
            if (!ESTADOS.includes(req.query.estado)) return error(res, 400, 'PARAMETRO_INVALIDO', `estado debe ser uno de: ${ESTADOS.join(', ')}.`);
            filtro.estado = req.query.estado;
        }

        const pedidos = await Pedido.find(filtro)
            .populate('restaurante_id', 'nombre especialidad direccion')
            .populate('repartidor_id', 'nombre vehiculo telefono')
            .sort({ fecha_pedido: -1 })
            .limit(100);

        res.status(200).json({
            exito: true,
            total: pedidos.length,
            operacion: 'find()',
            descripcion: 'Pedidos del usuario que inició sesión (el PIN solo lo ve el cliente)',
            consultaMQL: `Pedido.find(${JSON.stringify(filtro)}).sort({ fecha_pedido: -1 }).limit(100)`,
            datos: pedidos.map(p => ocultarPin(p, req.usuario))
        });
    } catch (e) {
        falla(res, e, 'Error al obtener los pedidos');
    }
};

// ─────────────────────────────────────────────────────────────────────
// CLIENTE
// ─────────────────────────────────────────────────────────────────────

// POST /api/mongo/pedidos  { items: [{ platillo_id, cantidad }] }
// El precio y el total se calculan en el servidor con los precios guardados (no se confía en el navegador).
exports.crearPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return error(res, 400, 'CARRITO_VACIO', 'Agrega al menos un platillo al carrito.');
        }
        if (items.length > 20) {
            return error(res, 422, 'DEMASIADOS_ITEMS', 'Un pedido puede tener como máximo 20 líneas.');
        }

        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) return error(res, 404, 'USUARIO_NO_ENCONTRADO', 'No encontramos tu cuenta.');

        const ids = items.map(it => it.platillo_id || it._id);
        if (!ids.every(esId)) return error(res, 400, 'ID_INVALIDO', 'Hay un platillo con identificador no válido.');
        const platillos = await Platillo.find({ _id: { $in: ids }, activo: true });
        const porId = new Map(platillos.map(p => [String(p._id), p]));

        const detalles = [];
        const restaurantes = new Set();
        for (const it of items) {
            const plato = porId.get(String(it.platillo_id || it._id));
            if (!plato) return error(res, 404, 'PLATILLO_NO_ENCONTRADO', 'Uno de los platillos ya no está disponible.');
            const cantidad = parseInt(it.cantidad, 10) || 1;
            if (cantidad < 1 || cantidad > 20) return error(res, 422, 'CANTIDAD_INVALIDA', 'La cantidad de cada platillo debe estar entre 1 y 20.');
            restaurantes.add(String(plato.restaurante_id));
            // Snapshot: se guarda el precio del momento; si el platillo cambia de precio, el pedido no cambia
            detalles.push({
                platillo_id: plato._id,
                nombre_platillo: plato.nombre,
                cantidad,
                precio_unitario: plato.precio,
                subtotal: plato.precio * cantidad
            });
        }
        if (restaurantes.size > 1) {
            return error(res, 422, 'VARIOS_RESTAURANTES', 'Un pedido solo puede tener platillos de un mismo restaurante.');
        }

        const total = detalles.reduce((s, d) => s + d.subtotal, 0) + COSTO_ENVIO;
        const codigo = `KALO-${new Date().getFullYear()}-${crypto.randomInt(100000, 1000000)}`;

        const nuevoPedido = await Pedido.create({
            codigo_pedido: codigo,
            fecha_pedido: new Date(),
            estado: 'En Preparación',
            cliente: {
                usuario_id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                telefono: usuario.telefono
            },
            restaurante_id: [...restaurantes][0],
            detalles,
            total
        });

        res.status(201).json({
            exito: true,
            mensaje: `¡Pedido ${codigo} creado! Verás tu PIN de entrega cuando el pedido salga del local.`,
            operacion: 'create()',
            consultaMQL: `Pedido.create({ codigo_pedido: "${codigo}", estado: "En Preparación", cliente: {...}, detalles: [...], total: ${total} })`,
            pedido: ocultarPin(nuevoPedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al registrar el pedido');
    }
};

// POST /api/mongo/pedidos/evaluar
exports.evaluarPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { codigo_pedido, similitud_foto, gramaje_porcion, velocidad_prep, calificacion_general, comentario } = req.body || {};
        if (!codigo_pedido) return error(res, 400, 'DATOS_FALTANTES', 'Indica el código del pedido.');

        const notas = { similitud_foto, gramaje_porcion, velocidad_prep, calificacion_general };
        for (const [campo, valor] of Object.entries(notas)) {
            const n = parseInt(valor, 10);
            if (!(n >= 1 && n <= 5)) return error(res, 422, 'NOTA_INVALIDA', `${campo} debe ser un número entre 1 y 5.`);
            notas[campo] = n;
        }

        const pedido = await Pedido.findOne({ codigo_pedido, 'cliente.usuario_id': req.usuario.id });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', 'No encontramos ese pedido entre los tuyos.');
        if (pedido.estado !== 'Entregado') return error(res, 409, 'PEDIDO_NO_ENTREGADO', 'Solo puedes evaluar un pedido que ya fue entregado.');

        pedido.evaluacion = { ...notas, comentario: comentario ? String(comentario).trim().slice(0, 500) : '', fecha_evaluacion: new Date() };
        pedido.calificacion_transp = notas.calificacion_general;
        await pedido.save();

        res.status(200).json({
            exito: true,
            mensaje: '¡Gracias! Tu evaluación quedó registrada.',
            operacion: 'updateOne() con subdocumento evaluacion',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${codigo_pedido}" }, { $set: { evaluacion: {...} } })`,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al guardar la evaluación');
    }
};

// PUT /api/mongo/usuarios/biometrico  { peso, altura, edad, genero, nombre?, telefono? }
exports.actualizarPerfilBiometrico = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { peso, altura, edad, genero, nombre, telefono } = req.body || {};
        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) return error(res, 404, 'USUARIO_NO_ENCONTRADO', 'No encontramos tu cuenta.');

        const pb = usuario.perfil_biometrico;
        const pesoKg = peso !== undefined ? parseFloat(peso) : pb.peso_kg;
        const alturaM = altura !== undefined ? parseFloat(altura) : pb.altura_m;
        if (!(pesoKg >= 20 && pesoKg <= 350) || !(alturaM >= 1 && alturaM <= 2.5)) {
            return error(res, 422, 'BIOMETRIA_INVALIDA', 'El peso debe estar entre 20 y 350 kg y la altura entre 1,00 y 2,50 m.');
        }
        if (telefono !== undefined && !telefonoValido(telefono)) {
            return error(res, 422, 'TELEFONO_INVALIDO', MENSAJE_TELEFONO);
        }
        pb.peso_kg = pesoKg;
        pb.altura_m = alturaM;
        if (edad !== undefined) pb.edad = parseInt(edad, 10);
        if (genero) pb.genero = genero;
        pb.imc = parseFloat((pesoKg / (alturaM * alturaM)).toFixed(1));

        // Cambio hipotético "un cliente cambia su nombre o teléfono": se actualiza la cuenta y,
        // con una sola instrucción, la copia (referencia extendida) que guardan sus pedidos.
        const copia = {};
        if (nombre && nombre.trim()) { usuario.nombre = nombre.trim(); copia['cliente.nombre'] = usuario.nombre; }
        if (telefono !== undefined) { usuario.telefono = normalizarTelefono(telefono); copia['cliente.telefono'] = usuario.telefono; }

        await usuario.save();
        let pedidosActualizados = 0;
        if (Object.keys(copia).length) {
            const r = await Pedido.updateMany({ 'cliente.usuario_id': usuario._id }, { $set: copia });
            pedidosActualizados = r.modifiedCount;
        }

        res.status(200).json({
            exito: true,
            mensaje: 'Perfil actualizado.',
            operacion: 'updateOne() con $set (y updateMany en pedidos si cambia el nombre o teléfono)',
            pedidos_actualizados: pedidosActualizados,
            usuario
        });
    } catch (e) {
        falla(res, e, 'Error al actualizar el perfil');
    }
};

// DELETE /api/mongo/usuarios/:usuario_id  (derecho de supresión, Ley 21.719)
exports.eliminarUsuario = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { usuario_id } = req.params;
        if (!esId(usuario_id)) return error(res, 400, 'ID_INVALIDO', 'El identificador no es válido.');
        if (String(usuario_id) !== String(req.usuario.id)) {
            return error(res, 403, 'SIN_PERMISO', 'Solo puedes eliminar tu propia cuenta.');
        }
        const borrado = await Usuario.findByIdAndDelete(usuario_id);
        if (!borrado) return error(res, 404, 'USUARIO_NO_ENCONTRADO', 'La cuenta ya no existe.');
        const r = await Pedido.deleteMany({ 'cliente.usuario_id': usuario_id });

        res.status(200).json({
            exito: true,
            mensaje: 'Tu cuenta y tus datos de salud fueron eliminados.',
            pedidos_eliminados: r.deletedCount
        });
    } catch (e) {
        falla(res, e, 'Error al eliminar los datos');
    }
};

// ─────────────────────────────────────────────────────────────────────
// RESTAURANTE
// ─────────────────────────────────────────────────────────────────────

// POST /api/mongo/platillos
exports.crearPlatillo = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const {
            nombre, descripcion, precio, calorias, categoria, imagen_url,
            proteinas, carbos, grasas, peso_porcion, alergenos, ingredientes_limpios, ingredientes
        } = req.body || {};

        if (!nombre || precio === undefined || calorias === undefined) {
            return error(res, 400, 'DATOS_FALTANTES', 'El nombre, el precio y las calorías son obligatorios.');
        }
        const precioN = parseFloat(precio);
        const caloriasN = parseInt(calorias, 10);
        if (!(precioN > 0) || !(caloriasN > 0)) {
            return error(res, 422, 'DATOS_INVALIDOS', 'El precio y las calorías deben ser números mayores que 0.');
        }
        if (Array.isArray(ingredientes) && ingredientes.length > 30) {
            return error(res, 422, 'DEMASIADOS_INGREDIENTES', 'Un platillo puede tener como máximo 30 ingredientes.');
        }

        // Foto subida desde el equipo (data URL JPEG/PNG/WebP en base64) o enlace https
        if (imagen_url) {
            const img = String(imagen_url);
            const esArchivo = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img);
            const esEnlace = /^https?:\/\/\S+$/.test(img) && img.length <= 2000;
            if (!esArchivo && !esEnlace) {
                return error(res, 422, 'IMAGEN_INVALIDA', 'La foto debe ser una imagen JPG, PNG o WebP.');
            }
            if (esArchivo && img.length > 700000) {
                return error(res, 413, 'IMAGEN_MUY_GRANDE', 'La foto es demasiado grande (máximo 500 KB después de comprimirla).');
            }
        }

        const indice = calcularIndiceTransparencia({ proteinas, carbos, grasas, peso_porcion, alergenos, ingredientes_limpios, ingredientes });

        const nuevo = await Platillo.create({
            nombre: String(nombre).trim(),
            descripcion: descripcion ? String(descripcion).trim() : undefined,
            categoria: categoria || 'Almuerzo',
            imagen_url: imagen_url || undefined,
            precio: precioN,
            calorias: caloriasN,
            macronutrientes: {
                proteinas_g: parseFloat(proteinas) || 0,
                carbohidratos_g: parseFloat(carbos) || 0,
                grasas_g: parseFloat(grasas) || 0
            },
            ingredientes: Array.isArray(ingredientes) ? ingredientes : [],
            peso_porcion_g: peso_porcion ? parseFloat(peso_porcion) : null,
            alergenos: alergenos ? String(alergenos).trim() : undefined,
            ingredientes_limpios: ingredientes_limpios === true || ingredientes_limpios === 'true',
            indice_transparencia: indice,
            restaurante_id: req.usuario.id // el restaurante sale del token
        });

        res.status(201).json({
            exito: true,
            mensaje: `¡Platillo registrado! Su Índice de Transparencia es ${indice}%.`,
            operacion: 'create()',
            consultaMQL: `Platillo.create({ nombre: "${nuevo.nombre}", indice_transparencia: ${indice}, ... })`,
            platillo: nuevo
        });
    } catch (e) {
        falla(res, e, 'Error al registrar el platillo');
    }
};

// PUT /api/mongo/pedidos/estado  { codigo_pedido, nuevo_estado, repartidor_id? }
// Al pasar a "En Camino" (despacho) se genera el PIN de 4 dígitos.
exports.actualizarEstadoPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    const { codigo_pedido, nuevo_estado, repartidor_id } = req.body || {};
    if (!codigo_pedido || !nuevo_estado) {
        return error(res, 400, 'DATOS_FALTANTES', 'Indica codigo_pedido y nuevo_estado.');
    }
    if (!ESTADOS.includes(nuevo_estado)) {
        return error(res, 422, 'ESTADO_INVALIDO', `nuevo_estado debe ser uno de: ${ESTADOS.join(', ')}.`);
    }
    try {
        const pedido = await Pedido.findOne({ codigo_pedido, restaurante_id: req.usuario.id });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', `El pedido ${codigo_pedido} no existe en tu local.`);

        const permitidos = SIGUIENTE[pedido.estado] || [];
        if (!permitidos.includes(nuevo_estado)) {
            return error(res, 409, 'CAMBIO_NO_PERMITIDO', `Un pedido "${pedido.estado}" no puede pasar a "${nuevo_estado}".`);
        }

        if (nuevo_estado === 'En Camino') {
            if (repartidor_id) {
                if (!esId(repartidor_id) || !(await Repartidor.exists({ _id: repartidor_id, activo: true }))) {
                    return error(res, 404, 'REPARTIDOR_NO_ENCONTRADO', 'El repartidor elegido no existe o no está activo.');
                }
                pedido.repartidor_id = repartidor_id;
            }
            pedido.pin_seguridad = pinAleatorio();
            pedido.pin_generado_en = new Date();
            pedido.intentos_pin = 0;
        }
        pedido.estado = nuevo_estado;
        await pedido.save();

        res.status(200).json({
            exito: true,
            mensaje: nuevo_estado === 'En Camino'
                ? `Pedido ${codigo_pedido} despachado. El cliente ya puede ver su PIN.`
                : `El pedido ${codigo_pedido} pasó a: ${nuevo_estado}`,
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${codigo_pedido}" }, { $set: { estado: "${nuevo_estado}"${nuevo_estado === 'En Camino' ? ', pin_seguridad: "****"' : ''} } })`,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al actualizar el pedido');
    }
};

// GET /api/mongo/repartidores
exports.obtenerRepartidores = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const repartidores = await Repartidor.find({ activo: true }, 'nombre vehiculo telefono estado calificacion');
        res.status(200).json({
            exito: true,
            total: repartidores.length,
            operacion: 'find({ activo: true })',
            consultaMQL: 'Repartidor.find({ activo: true }, "nombre vehiculo telefono estado calificacion")',
            datos: repartidores
        });
    } catch (e) {
        falla(res, e, 'Error al obtener los repartidores');
    }
};

// PUT /api/mongo/restaurantes/mi-local
exports.actualizarMiLocal = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { nombre, direccion, telefono, especialidad } = req.body || {};
        if (telefono !== undefined && !telefonoValido(telefono)) {
            return error(res, 422, 'TELEFONO_INVALIDO', MENSAJE_TELEFONO);
        }
        const rest = await Restaurante.findById(req.usuario.id);
        if (!rest) return error(res, 404, 'RESTAURANTE_NO_ENCONTRADO', 'No encontramos tu local.');

        if (nombre) rest.nombre = String(nombre).trim();
        if (direccion) rest.direccion = String(direccion).trim();
        if (telefono !== undefined) rest.telefono = normalizarTelefono(telefono);
        if (especialidad) rest.especialidad = String(especialidad).trim();
        await rest.save();

        res.status(200).json({
            exito: true,
            mensaje: `¡Datos de "${rest.nombre}" actualizados!`,
            restaurante: rest
        });
    } catch (e) {
        falla(res, e, 'Error al actualizar el local');
    }
};

// ─────────────────────────────────────────────────────────────────────
// REPARTIDOR
// ─────────────────────────────────────────────────────────────────────

// PUT /api/mongo/pedidos/aceptar  { codigo_pedido }
exports.aceptarPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    const { codigo_pedido } = req.body || {};
    if (!codigo_pedido) return error(res, 400, 'DATOS_FALTANTES', 'Indica el código del pedido.');
    try {
        const pedido = await Pedido.findOne({ codigo_pedido });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', `El pedido ${codigo_pedido} no existe.`);
        if (pedido.repartidor_id && String(pedido.repartidor_id) !== String(req.usuario.id)) {
            return error(res, 409, 'PEDIDO_TOMADO', 'Otro repartidor ya tomó este pedido.');
        }
        if (!['En Preparación', 'En Camino'].includes(pedido.estado)) {
            return error(res, 409, 'CAMBIO_NO_PERMITIDO', `No se puede aceptar un pedido "${pedido.estado}".`);
        }

        pedido.repartidor_id = req.usuario.id;
        if (pedido.estado !== 'En Camino' || !pedido.pin_seguridad) {
            pedido.estado = 'En Camino';
            pedido.pin_seguridad = pinAleatorio(); // el PIN se crea cuando el pedido sale
            pedido.pin_generado_en = new Date();
            pedido.intentos_pin = 0;
        }
        await pedido.save();

        res.status(200).json({
            exito: true,
            mensaje: `Aceptaste el pedido ${codigo_pedido}. Ya va en camino.`,
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${codigo_pedido}" }, { $set: { estado: "En Camino", repartidor_id: ... } })`,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al aceptar el pedido');
    }
};

// POST /api/mongo/pedidos/validar-pin  { codigo_pedido, pin_ingresado }
exports.validarPinEntrega = async (req, res) => {
    if (!verificarConexion(res)) return;
    const { codigo_pedido, pin_ingresado } = req.body || {};
    if (!codigo_pedido || !pin_ingresado) {
        return error(res, 400, 'DATOS_FALTANTES', 'Indica el código del pedido y el PIN de 4 dígitos.');
    }
    if (!/^\d{4}$/.test(String(pin_ingresado).trim())) {
        return error(res, 422, 'PIN_FORMATO', 'El PIN debe tener exactamente 4 dígitos.');
    }
    try {
        const pedido = await Pedido.findOne({ codigo_pedido });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', `El pedido ${codigo_pedido} no existe.`);
        if (pedido.repartidor_id && String(pedido.repartidor_id) !== String(req.usuario.id)) {
            return error(res, 403, 'SIN_PERMISO', 'Este pedido está asignado a otro repartidor.');
        }
        if (pedido.estado === 'Entregado') return error(res, 409, 'YA_ENTREGADO', 'Este pedido ya fue entregado.');
        if (pedido.estado !== 'En Camino' || !pedido.pin_seguridad) {
            return error(res, 409, 'PEDIDO_NO_DESPACHADO', 'El pedido todavía no sale del local.');
        }
        if (pedido.intentos_pin >= MAX_INTENTOS_PIN) {
            return error(res, 423, 'PIN_BLOQUEADO', 'Se superaron los 5 intentos. El restaurante debe revisar el pedido.');
        }

        if (pedido.pin_seguridad !== String(pin_ingresado).trim()) {
            pedido.intentos_pin += 1;
            await pedido.save();
            const quedan = MAX_INTENTOS_PIN - pedido.intentos_pin;
            return error(res, 401, 'PIN_INCORRECTO', `PIN de entrega incorrecto. Te quedan ${quedan} intento(s).`);
        }

        pedido.estado = 'Entregado';
        pedido.repartidor_id = pedido.repartidor_id || req.usuario.id;
        await pedido.save();

        res.status(200).json({
            exito: true,
            mensaje: '¡Entrega confirmada! El PIN es correcto.',
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${codigo_pedido}" }, { $set: { estado: "Entregado" } })`,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al validar el PIN');
    }
};
