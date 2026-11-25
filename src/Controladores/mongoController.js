/**
 * CONTROLADOR MONGODB (Kalo): catálogo, pedidos, perfil y restaurante.
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
const Notificacion = require('../Modelos/mongo/Notificacion');
const FotoCocina = require('../Modelos/mongo/FotoCocina');
const { normalizarTelefono, telefonoValido, MENSAJE_TELEFONO } = require('../utils/telefono');
const { error, falla, verificarConexion, esId, revisarImagen } = require('../utils/respuestas');
const { calcularIndiceTransparencia, calcularNutrientes, METODOS_COCCION } = require('../utils/nutricion');
const { armarPerfil } = require('../utils/perfil');
const { recalcularIndiceRestaurante } = require('../utils/ranking');
const { revisarPago } = require('../utils/pago');
const { avisar, numero } = require('../utils/avisos');
const { datosPublicos } = require('./authController');

const COSTO_ENVIO = 1490;
const MAX_INTENTOS_PIN = 5;
const ESTADOS = ['Pendiente', 'Pagado', 'En Preparación', 'En Camino', 'Entregado', 'Cancelado'];
// Avances permitidos del pedido (el restaurante no puede saltar ni retroceder estados) · RF-20
const SIGUIENTE = {
    'Pagado': ['En Preparación', 'Cancelado'],
    'En Preparación': ['En Camino', 'Cancelado'],
    'En Camino': [],
    'Entregado': [],
    'Cancelado': []
};

// Escapa el texto del buscador para usarlo en $regex sin que el usuario inyecte expresiones
const escaparRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pinAleatorio = () => String(crypto.randomInt(0, 10000)).padStart(4, '0');

// RF-15: PIN de 4 dígitos que no se repite entre los pedidos que van en camino
async function pinUnico() {
    for (let i = 0; i < 20; i++) {
        const pin = pinAleatorio();
        if (!(await Pedido.exists({ estado: 'En Camino', pin_seguridad: pin }))) return pin;
    }
    return pinAleatorio();
}

// Quita el PIN y los datos del pago cuando quien consulta no es el cliente dueño (RF-16)
function ocultarPin(pedido, usuario) {
    const p = pedido.toObject ? pedido.toObject() : { ...pedido };
    const esDueno = usuario && usuario.rol === 'cliente' && String(p.cliente?.usuario_id) === String(usuario.id);
    if (!esDueno) {
        delete p.pin_seguridad;
        if (p.pago) p.pago = { estado: p.pago.estado, metodo: p.pago.metodo };
    }
    delete p.intentos_pin;
    return p;
}

// ─────────────────────────────────────────────────────────────────────
// CATÁLOGO (público)
// ─────────────────────────────────────────────────────────────────────

// GET /api/mongo/platillos?categoria=&busqueda=&maxCalorias=&minProteina=&maxCarbohidratos=&maxPrecio=&minTransparencia=&restaurante=
// RF-04 (filtros nutricionales) y RF-11 (los locales con mejor Índice de Transparencia aparecen primero)
exports.obtenerPlatillos = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { categoria, busqueda, restaurante } = req.query;
        const filtro = { activo: true };
        if (categoria && categoria !== 'todas') filtro.categoria = String(categoria);
        if (busqueda) filtro.nombre = { $regex: escaparRegex(busqueda), $options: 'i' };
        if (restaurante) {
            if (!esId(restaurante)) return error(res, 400, 'PARAMETRO_INVALIDO', 'restaurante no es un identificador válido.');
            filtro.restaurante_id = new Platillo.base.Types.ObjectId(String(restaurante));
        }

        // [parámetro, campo, operador, mínimo permitido, mensaje]
        const numericos = [
            ['maxCalorias', 'calorias', '$lte', 1, 'maxCalorias debe ser un número mayor que 0.'],
            ['minProteina', 'macronutrientes.proteinas_g', '$gte', 0, 'minProteina debe ser un número mayor o igual a 0.'],
            ['maxCarbohidratos', 'macronutrientes.carbohidratos_g', '$lte', 0, 'maxCarbohidratos debe ser un número mayor o igual a 0.'],
            ['maxPrecio', 'precio', '$lte', 1, 'maxPrecio debe ser un número mayor que 0.'],
            ['minTransparencia', 'indice_transparencia', '$gte', 0, 'minTransparencia debe estar entre 0 y 100.']
        ];
        for (const [param, campo, op, minimo, mensaje] of numericos) {
            if (req.query[param] === undefined || req.query[param] === '') continue;
            const n = parseFloat(req.query[param]);
            if (!(n >= minimo) || (param === 'minTransparencia' && n > 100)) return error(res, 400, 'PARAMETRO_INVALIDO', mensaje);
            filtro[campo] = { ...(filtro[campo] || {}), [op]: n };
        }

        const tuberia = [
            { $match: filtro },
            { $lookup: { from: 'restaurantes', localField: 'restaurante_id', foreignField: '_id', as: 'restaurante_id' } },
            { $unwind: '$restaurante_id' },
            { $match: { 'restaurante_id.activo': true } },
            { $project: { 'restaurante_id.password_hash': 0, 'restaurante_id.correo': 0, 'restaurante_id.__v': 0 } },
            { $sort: { 'restaurante_id.indice_transparencia': -1, indice_transparencia: -1, precio: 1 } }
        ];
        const platillos = await Platillo.aggregate(tuberia);
        res.status(200).json({
            exito: true,
            total: platillos.length,
            operacion: 'aggregate() con $match, $lookup y $sort',
            descripcion: 'Platillos activos; primero los locales con mejor Índice de Transparencia',
            consultaMQL: `Platillo.aggregate([ { $match: ${JSON.stringify(filtro)} }, { $lookup: { from: "restaurantes", ... } }, { $sort: { "restaurante.indice_transparencia": -1, indice_transparencia: -1, precio: 1 } } ])`,
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
        const platillos = await Platillo.find({ calorias: { $lte: limite }, activo: true }).sort({ calorias: 1 }).lean();
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
                    'restaurante.nombre': 1, 'restaurante.especialidad': 1, 'restaurante.indice_transparencia': 1,
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
        const planes = await PlanNutricional.find(filtro).sort({ precio_mensual: -1 }).lean();
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

// GET /api/mongo/estadisticas
// $group cuenta los clientes por género. Como peso, altura, IMC y meta están cifrados en la base
// (RNF-02), los promedios se calculan en el servidor después de descifrarlos: Atlas nunca los ve.
exports.obtenerEstadisticasBiometricas = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const conteo = await Usuario.aggregate([
            { $group: { _id: '$perfil_biometrico.genero', totalUsuarios: { $sum: 1 } } },
            { $sort: { totalUsuarios: -1 } }
        ]);
        const usuarios = await Usuario.find({}, 'perfil_biometrico');
        const suma = {};
        for (const u of usuarios) {
            const pb = u.perfil_biometrico || {};
            const g = pb.genero || 'Otro';
            suma[g] = suma[g] || { peso: 0, altura: 0, imc: 0, meta: 0, n: 0 };
            if (pb.peso_kg > 0) {
                suma[g].peso += pb.peso_kg; suma[g].altura += pb.altura_m;
                suma[g].imc += pb.imc || 0; suma[g].meta += pb.meta_calorica_diaria || 0; suma[g].n++;
            }
        }
        const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
        const datos = conteo.map(({ _id, totalUsuarios }) => {
            const s = suma[_id || 'Otro'] || { n: 0 };
            const prom = (k, d) => (s.n ? r(s[k] / s.n, d) : null);
            return {
                genero: _id, totalUsuarios,
                pesoPromedio: prom('peso', 1), alturaPromedio: prom('altura', 2),
                imcPromedio: prom('imc', 1), metaCaloricaPromedio: prom('meta', 0)
            };
        });
        res.status(200).json({
            exito: true,
            operacion: 'aggregate() con $group + promedios sobre datos descifrados',
            descripcion: 'Cantidad de clientes y promedios biométricos por género (datos agregados, sin nombres)',
            consultaMQL: 'Usuario.aggregate([ { $group: { _id: "$perfil_biometrico.genero", totalUsuarios: { $sum: 1 } } }, { $sort: { totalUsuarios: -1 } } ]) + promedios en el servidor (datos de salud cifrados)',
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
        else filtro = { tipo: { $ne: 'plan' }, $or: [{ repartidor_id: id }, { repartidor_id: null, estado: { $in: ['En Preparación', 'En Camino'] } }] };

        if (req.query.estado) {
            if (!ESTADOS.includes(req.query.estado)) return error(res, 400, 'PARAMETRO_INVALIDO', `estado debe ser uno de: ${ESTADOS.join(', ')}.`);
            filtro.estado = req.query.estado;
        }

        const pedidos = await Pedido.find(filtro)
            .populate('restaurante_id', 'nombre especialidad direccion telefono')
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

// POST /api/mongo/pedidos  { items: [{ platillo_id, cantidad }], pago: { referencia, marca, ultimos4, metodo } }
// El precio y el total se calculan en el servidor con los precios guardados (no se confía en el navegador).
// El pago ya lo aprobó la pasarela (RNF-07): aquí solo se guarda su referencia. Estado inicial: "Pagado" (RF-20).
exports.crearPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { items, pago } = req.body || {};
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
            // Snapshot: se guarda el precio y las calorías del momento; si el platillo cambia, el pedido no cambia
            detalles.push({
                platillo_id: plato._id,
                nombre_platillo: plato.nombre,
                cantidad,
                precio_unitario: plato.precio,
                subtotal: plato.precio * cantidad,
                calorias: plato.calorias
            });
        }
        if (restaurantes.size > 1) {
            return error(res, 422, 'VARIOS_RESTAURANTES', 'Un pedido solo puede tener platillos de un mismo restaurante.');
        }

        const revision = revisarPago(pago, req.body);
        if (revision.error) return error(res, ...revision.error);

        const total = detalles.reduce((s, d) => s + d.subtotal, 0) + COSTO_ENVIO;
        const totalCalorias = detalles.reduce((s, d) => s + d.calorias * d.cantidad, 0);
        const codigo = `KALO-${new Date().getFullYear()}-${crypto.randomInt(100000, 1000000)}`;
        const restauranteId = [...restaurantes][0];

        const nuevoPedido = await Pedido.create({
            codigo_pedido: codigo,
            fecha_pedido: new Date(),
            estado: 'Pagado',
            tipo: 'platillos',
            pago: revision.pago,
            cliente: {
                usuario_id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                telefono: usuario.telefono
            },
            restaurante_id: restauranteId,
            detalles,
            total,
            total_calorias: totalCalorias
        });

        // RF-20: se notifica al restaurante
        await avisar(restauranteId, 'restaurante', 'nuevo_pedido', 'Nuevo pedido pagado',
            `${usuario.nombre} pagó el pedido ${numero(codigo)} (${detalles.reduce((s, d) => s + d.cantidad, 0)} platillos).`, codigo);

        res.status(201).json({
            exito: true,
            mensaje: `¡Pago aprobado! Pedido ${codigo} enviado al local. Verás tu PIN de entrega cuando salga.`,
            operacion: 'create()',
            consultaMQL: `Pedido.create({ codigo_pedido: "${codigo}", estado: "Pagado", cliente: {...}, detalles: [...], total: ${total} })`,
            pedido: ocultarPin(nuevoPedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al registrar el pedido');
    }
};

// POST /api/mongo/pedidos/evaluar  (RF-12, RF-13) → recalcula el ranking del local (RF-14)
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

        const pedido = await Pedido.findOne({ codigo_pedido: String(codigo_pedido), 'cliente.usuario_id': req.usuario.id });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', 'No encontramos ese pedido entre los tuyos.');
        if (pedido.estado !== 'Entregado') return error(res, 409, 'PEDIDO_NO_ENTREGADO', 'Solo puedes evaluar un pedido que ya fue entregado.');
        if (pedido.evaluacion?.calificacion_general) return error(res, 409, 'YA_EVALUADO', 'Ya evaluaste este pedido.');

        pedido.evaluacion = { ...notas, comentario: comentario ? String(comentario).trim().slice(0, 500) : '', fecha_evaluacion: new Date() };
        pedido.calificacion_transp = Math.round((notas.similitud_foto + notas.gramaje_porcion) / 2);
        await pedido.save();

        const ranking = await recalcularIndiceRestaurante(pedido.restaurante_id);
        await avisar(pedido.restaurante_id, 'restaurante', 'nueva_evaluacion', 'Nueva evaluación',
            `El pedido ${numero(pedido.codigo_pedido)} recibió ${notas.calificacion_general} de 5 estrellas. Tu índice quedó en ${ranking.indice_transparencia} %.`, pedido.codigo_pedido);

        res.status(200).json({
            exito: true,
            mensaje: '¡Gracias! Tu evaluación quedó registrada.',
            operacion: 'updateOne() con subdocumento evaluacion + aggregate() para el ranking',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${pedido.codigo_pedido}" }, { $set: { evaluacion: {...} } })`,
            indice_restaurante: ranking.indice_transparencia,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al guardar la evaluación');
    }
};

// PUT /api/mongo/usuarios/biometrico  { peso, altura, edad, genero, nivel_actividad, objetivo, nombre?, telefono? }
// RF-01 a RF-03: recalcula el IMC y la meta calórica. Los datos de salud se guardan cifrados (RNF-02).
exports.actualizarPerfilBiometrico = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { nombre, telefono } = req.body || {};
        const usuario = await Usuario.findById(req.usuario.id);
        if (!usuario) return error(res, 404, 'USUARIO_NO_ENCONTRADO', 'No encontramos tu cuenta.');

        const anterior = usuario.perfil_biometrico ? usuario.perfil_biometrico.toObject() : {};
        const { perfil, error: errorPerfil } = armarPerfil(req.body || {}, anterior);
        if (errorPerfil) return error(res, 422, 'BIOMETRIA_INVALIDA', errorPerfil);
        if (telefono !== undefined && !telefonoValido(telefono)) {
            return error(res, 422, 'TELEFONO_INVALIDO', MENSAJE_TELEFONO);
        }
        // Con un plan contratado, la meta del día es la del plan (RF-21)
        if (usuario.plan_activo?.calorias_diarias) perfil.meta_calorica_diaria = usuario.plan_activo.calorias_diarias;
        usuario.perfil_biometrico = perfil;

        // Cambio hipotético "un cliente cambia su nombre o teléfono": se actualiza la cuenta y,
        // con una sola instrucción, la copia (referencia extendida) que guardan sus pedidos.
        const copia = {};
        if (nombre && String(nombre).trim()) { usuario.nombre = String(nombre).trim(); copia['cliente.nombre'] = usuario.nombre; }
        if (telefono !== undefined) { usuario.telefono = normalizarTelefono(telefono); copia['cliente.telefono'] = usuario.telefono; }

        await usuario.save();
        let pedidosActualizados = 0;
        if (Object.keys(copia).length) {
            const r = await Pedido.updateMany({ 'cliente.usuario_id': usuario._id }, { $set: copia });
            pedidosActualizados = r.modifiedCount;
        }

        res.status(200).json({
            exito: true,
            mensaje: `Perfil actualizado. Tu meta es ${perfil.meta_calorica_diaria.toLocaleString('es-CL')} kcal al día.`,
            operacion: 'updateOne() con $set (y updateMany en pedidos si cambia el nombre o teléfono)',
            pedidos_actualizados: pedidosActualizados,
            usuario: datosPublicos(usuario, 'cliente')
        });
    } catch (e) {
        falla(res, e, 'Error al actualizar el perfil');
    }
};

// DELETE /api/mongo/usuarios/:usuario_id  (derecho de supresión, Ley 21.719 · RNF-09)
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
        await Notificacion.deleteMany({ destinatario_id: usuario_id });

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

// Limpia la lista de ingredientes que manda el formulario (RF-06)
function limpiarIngredientes(lista) {
    return (Array.isArray(lista) ? lista : [])
        .filter(i => i && String(i.nombre || '').trim())
        .map(i => ({
            nombre: String(i.nombre).trim().slice(0, 60),
            cantidad_g: Math.min(5000, Math.max(0, parseFloat(i.cantidad_g) || 0)),
            unidad: i.unidad === 'ml' ? 'ml' : 'g',
            metodo_coccion: METODOS_COCCION.includes(i.metodo_coccion) ? i.metodo_coccion : 'Sin especificar'
        }));
}

// POST /api/mongo/platillos  (RF-06, RF-08, RF-09)
// Si viene calcular_nutricion: true (o faltan las calorías), Kalo calcula calorías y macros a partir
// de los ingredientes con su servicio de información nutricional.
exports.crearPlatillo = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const {
            nombre, descripcion, precio, categoria, imagen_url,
            peso_porcion, alergenos, ingredientes_limpios, calcular_nutricion
        } = req.body || {};
        let { calorias, proteinas, carbos, grasas } = req.body || {};

        if (!nombre || precio === undefined) {
            return error(res, 400, 'DATOS_FALTANTES', 'El nombre y el precio son obligatorios.');
        }
        if (Array.isArray(req.body.ingredientes) && req.body.ingredientes.length > 30) {
            return error(res, 422, 'DEMASIADOS_INGREDIENTES', 'Un platillo puede tener como máximo 30 ingredientes.');
        }
        const ingredientes = limpiarIngredientes(req.body.ingredientes);

        // RF-08: cálculo nutricional automatizado
        let nutricionCalculada = false;
        if (calcular_nutricion === true || calcular_nutricion === 'true' || (calorias === undefined || calorias === '')) {
            const n = calcularNutrientes(ingredientes);
            if (n.calorias > 0) {
                calorias = n.calorias; proteinas = n.proteinas; carbos = n.carbos; grasas = n.grasas;
                nutricionCalculada = true;
            }
        }
        if (calorias === undefined || calorias === '') {
            return error(res, 400, 'DATOS_FALTANTES', 'Indica las calorías o agrega ingredientes para calcularlas.');
        }
        const precioN = parseFloat(precio);
        const caloriasN = Math.round(parseFloat(calorias));
        if (!(precioN > 0) || !(caloriasN > 0)) {
            return error(res, 422, 'DATOS_INVALIDOS', 'El precio y las calorías deben ser números mayores que 0.');
        }

        if (imagen_url) {
            const problema = revisarImagen(imagen_url);
            if (problema) return error(res, ...problema);
        }

        const { indice } = calcularIndiceTransparencia({
            proteinas, carbos, grasas, calorias: caloriasN, peso_porcion, alergenos, descripcion,
            ingredientes, foto_propia: !!imagen_url
        });

        const nuevo = await Platillo.create({
            nombre: String(nombre).trim(),
            descripcion: descripcion ? String(descripcion).trim().slice(0, 400) : undefined,
            categoria: ['Desayuno', 'Almuerzo', 'Cena', 'Snack'].includes(categoria) ? categoria : 'Almuerzo',
            imagen_url: imagen_url || undefined,
            precio: precioN,
            calorias: caloriasN,
            macronutrientes: {
                proteinas_g: parseFloat(proteinas) || 0,
                carbohidratos_g: parseFloat(carbos) || 0,
                grasas_g: parseFloat(grasas) || 0
            },
            ingredientes,
            peso_porcion_g: parseFloat(peso_porcion) > 0 ? parseFloat(peso_porcion) : null,
            alergenos: alergenos ? String(alergenos).trim().slice(0, 120) : undefined,
            ingredientes_limpios: ingredientes_limpios === true || ingredientes_limpios === 'true',
            indice_transparencia: indice,
            nutricion_calculada: nutricionCalculada,
            restaurante_id: req.usuario.id // el restaurante sale del token
        });
        const ranking = await recalcularIndiceRestaurante(req.usuario.id);

        res.status(201).json({
            exito: true,
            mensaje: `¡Platillo registrado! Su Índice de Transparencia es ${indice}%.`,
            operacion: 'create()',
            consultaMQL: `Platillo.create({ nombre: "${nuevo.nombre}", indice_transparencia: ${indice}, ... })`,
            indice_restaurante: ranking.indice_transparencia,
            platillo: nuevo
        });
    } catch (e) {
        falla(res, e, 'Error al registrar el platillo');
    }
};

// PUT /api/mongo/pedidos/estado  { codigo_pedido, nuevo_estado, repartidor_id? }
// RF-20: Pagado → En Preparación (aceptar) → En Camino (despachar). Al despachar se genera el PIN (RF-15).
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
        const pedido = await Pedido.findOne({ codigo_pedido: String(codigo_pedido), restaurante_id: req.usuario.id });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', `El pedido ${codigo_pedido} no existe en tu local.`);

        const permitidos = SIGUIENTE[pedido.estado] || [];
        if (!permitidos.includes(nuevo_estado)) {
            return error(res, 409, 'CAMBIO_NO_PERMITIDO', `Un pedido "${pedido.estado}" no puede pasar a "${nuevo_estado}".`);
        }

        const cliente = pedido.cliente.usuario_id;
        const num = numero(pedido.codigo_pedido);
        if (nuevo_estado === 'En Camino') {
            if (repartidor_id) {
                if (!esId(repartidor_id) || !(await Repartidor.exists({ _id: repartidor_id, activo: true }))) {
                    return error(res, 404, 'REPARTIDOR_NO_ENCONTRADO', 'El repartidor elegido no existe o no está activo.');
                }
                pedido.repartidor_id = repartidor_id;
            }
            pedido.pin_seguridad = await pinUnico();
            pedido.pin_generado_en = new Date();
            pedido.despachado_en = new Date();
            pedido.intentos_pin = 0;
        }
        if (nuevo_estado === 'Cancelado' && pedido.pago) pedido.pago.estado = 'Reembolsado';
        pedido.estado = nuevo_estado;
        await pedido.save();

        // Avisos al cliente (RF-23: sin PIN ni datos de salud) y al repartidor
        if (nuevo_estado === 'En Preparación') {
            await avisar(cliente, 'cliente', 'pedido_aceptado', 'Pedido aceptado', `El local aceptó tu pedido ${num} y ya lo está preparando.`, pedido.codigo_pedido);
        } else if (nuevo_estado === 'Cancelado') {
            await avisar(cliente, 'cliente', 'pedido_cancelado', 'Pedido cancelado', `El local no pudo preparar tu pedido ${num}. Se reembolsó el pago.`, pedido.codigo_pedido);
        } else if (nuevo_estado === 'En Camino') {
            await avisar(cliente, 'cliente', 'pedido_en_camino', 'Tu pedido salió del local', `El pedido ${num} va en camino. Ten a mano tu PIN de entrega (está en Mis pedidos).`, pedido.codigo_pedido);
            if (pedido.repartidor_id) {
                await avisar(pedido.repartidor_id, 'repartidor', 'pedido_asignado', 'Te asignaron un pedido', `Retira el pedido ${num} y llévalo a ${pedido.cliente.nombre}.`, pedido.codigo_pedido);
                await Repartidor.updateOne({ _id: pedido.repartidor_id }, { $set: { estado: 'En Reparto' } });
            }
        }

        res.status(200).json({
            exito: true,
            mensaje: {
                'En Preparación': `Aceptaste el pedido ${num}. ¡A cocinar!`,
                'En Camino': `Pedido ${num} despachado. El cliente ya puede ver su PIN.`,
                'Cancelado': `Rechazaste el pedido ${num}. Se avisó al cliente y se reembolsó el pago.`
            }[nuevo_estado] || `El pedido ${num} pasó a: ${nuevo_estado}`,
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${pedido.codigo_pedido}" }, { $set: { estado: "${nuevo_estado}"${nuevo_estado === 'En Camino' ? ', pin_seguridad: "****"' : ''} } })`,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al actualizar el pedido');
    }
};

// GET /api/mongo/repartidores  (los disponibles primero)
exports.obtenerRepartidores = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const repartidores = await Repartidor.find({ activo: true, estado: { $ne: 'Desconectado' } }, 'nombre vehiculo telefono estado calificacion')
            .sort({ estado: 1, calificacion: -1 }).lean();
        res.status(200).json({
            exito: true,
            total: repartidores.length,
            operacion: 'find({ activo: true, estado: { $ne: "Desconectado" } })',
            consultaMQL: 'Repartidor.find({ activo: true, estado: { $ne: "Desconectado" } }, "nombre vehiculo telefono estado calificacion")',
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
            restaurante: datosPublicos(rest, 'restaurante')
        });
    } catch (e) {
        falla(res, e, 'Error al actualizar el local');
    }
};

// ─────────────────────────────────────────────────────────────────────
// REPARTIDOR
// ─────────────────────────────────────────────────────────────────────

// PUT /api/mongo/pedidos/aceptar  { codigo_pedido }  (RF-17)
exports.aceptarPedido = async (req, res) => {
    if (!verificarConexion(res)) return;
    const { codigo_pedido } = req.body || {};
    if (!codigo_pedido) return error(res, 400, 'DATOS_FALTANTES', 'Indica el código del pedido.');
    try {
        const pedido = await Pedido.findOne({ codigo_pedido: String(codigo_pedido), tipo: { $ne: 'plan' } });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', `El pedido ${codigo_pedido} no existe.`);
        if (pedido.repartidor_id && String(pedido.repartidor_id) !== String(req.usuario.id)) {
            return error(res, 409, 'PEDIDO_TOMADO', 'Otro repartidor ya tomó este pedido.');
        }
        if (!['En Preparación', 'En Camino'].includes(pedido.estado)) {
            return error(res, 409, 'CAMBIO_NO_PERMITIDO', `No se puede aceptar un pedido "${pedido.estado}".`);
        }

        pedido.repartidor_id = req.usuario.id;
        const recienSale = pedido.estado !== 'En Camino' || !pedido.pin_seguridad;
        if (recienSale) {
            pedido.estado = 'En Camino';
            pedido.pin_seguridad = await pinUnico(); // el PIN se crea cuando el pedido sale
            pedido.pin_generado_en = new Date();
            pedido.despachado_en = new Date();
            pedido.intentos_pin = 0;
        }
        await pedido.save();
        await Repartidor.updateOne({ _id: req.usuario.id }, { $set: { estado: 'En Reparto' } });

        const num = numero(pedido.codigo_pedido);
        if (recienSale) {
            await avisar(pedido.cliente.usuario_id, 'cliente', 'pedido_en_camino', 'Tu pedido salió del local', `El pedido ${num} va en camino. Ten a mano tu PIN de entrega (está en Mis pedidos).`, pedido.codigo_pedido);
        }
        await avisar(pedido.restaurante_id, 'restaurante', 'pedido_asignado', 'Repartidor asignado', `${req.usuario.nombre} tomó el pedido ${num}.`, pedido.codigo_pedido);

        res.status(200).json({
            exito: true,
            mensaje: `Aceptaste el pedido ${pedido.codigo_pedido}. Ya va en camino.`,
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${pedido.codigo_pedido}" }, { $set: { estado: "En Camino", repartidor_id: ... } })`,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al aceptar el pedido');
    }
};

// PUT /api/mongo/pedidos/cerca  { codigo_pedido }  (RF-23: "tu repartidor está a 5 minutos o menos")
exports.avisarCercania = async (req, res) => {
    if (!verificarConexion(res)) return;
    const { codigo_pedido } = req.body || {};
    if (!codigo_pedido) return error(res, 400, 'DATOS_FALTANTES', 'Indica el código del pedido.');
    try {
        const pedido = await Pedido.findOne({ codigo_pedido: String(codigo_pedido), repartidor_id: req.usuario.id });
        if (!pedido) return error(res, 404, 'PEDIDO_NO_ENCONTRADO', 'Ese pedido no está asignado a ti.');
        if (pedido.estado !== 'En Camino') return error(res, 409, 'CAMBIO_NO_PERMITIDO', 'El pedido no está en camino.');
        if (pedido.aviso_cercano_en) {
            return res.status(200).json({ exito: true, mensaje: 'El cliente ya sabe que estás cerca.', pedido: ocultarPin(pedido, req.usuario) });
        }
        pedido.aviso_cercano_en = new Date();
        await pedido.save();
        await avisar(pedido.cliente.usuario_id, 'cliente', 'repartidor_cerca', 'Tu repartidor está cerca',
            `${req.usuario.nombre} llegará en 5 minutos o menos con tu pedido ${numero(pedido.codigo_pedido)}.`, pedido.codigo_pedido);
        res.status(200).json({ exito: true, mensaje: 'Le avisamos al cliente que llegas en 5 minutos.', pedido: ocultarPin(pedido, req.usuario) });
    } catch (e) {
        falla(res, e, 'Error al avisar al cliente');
    }
};

// PUT /api/mongo/repartidores/disponibilidad  { estado: "Disponible" | "Desconectado" }
exports.cambiarDisponibilidad = async (req, res) => {
    if (!verificarConexion(res)) return;
    try {
        const { estado } = req.body || {};
        if (!['Disponible', 'Desconectado'].includes(estado)) {
            return error(res, 422, 'ESTADO_INVALIDO', 'estado debe ser "Disponible" o "Desconectado".');
        }
        const rep = await Repartidor.findByIdAndUpdate(req.usuario.id, { $set: { estado } }, { new: true });
        if (!rep) return error(res, 404, 'REPARTIDOR_NO_ENCONTRADO', 'No encontramos tu cuenta.');
        res.status(200).json({ exito: true, mensaje: estado === 'Disponible' ? 'Estás disponible para recibir pedidos.' : 'Te desconectaste. No recibirás pedidos nuevos.', estado: rep.estado });
    } catch (e) {
        falla(res, e, 'Error al cambiar la disponibilidad');
    }
};

// POST /api/mongo/pedidos/validar-pin  { codigo_pedido, pin_ingresado }  (RF-17, RF-18)
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
        const pedido = await Pedido.findOne({ codigo_pedido: String(codigo_pedido) });
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

        const num = numero(pedido.codigo_pedido);
        if (pedido.pin_seguridad !== String(pin_ingresado).trim()) {
            pedido.intentos_pin += 1;
            await pedido.save();
            const quedan = MAX_INTENTOS_PIN - pedido.intentos_pin;
            if (quedan === 0) {
                await avisar(pedido.restaurante_id, 'restaurante', 'pin_bloqueado', 'PIN bloqueado', `El pedido ${num} superó los 5 intentos de PIN. Contacta al cliente.`, pedido.codigo_pedido);
            }
            return error(res, 401, 'PIN_INCORRECTO', `PIN de entrega incorrecto. Te quedan ${quedan} intento(s).`);
        }

        pedido.estado = 'Entregado';
        pedido.entregado_en = new Date();
        pedido.repartidor_id = pedido.repartidor_id || req.usuario.id;
        await pedido.save();

        // El repartidor vuelve a estar disponible si no le quedan pedidos en camino
        if (!(await Pedido.exists({ repartidor_id: req.usuario.id, estado: 'En Camino' }))) {
            await Repartidor.updateOne({ _id: req.usuario.id, estado: 'En Reparto' }, { $set: { estado: 'Disponible' } });
        }
        // RF-12 y RF-18: se libera la evaluación y se avisa al cliente
        await avisar(pedido.cliente.usuario_id, 'cliente', 'evaluar', '¡Pedido entregado!', `Cuéntanos cómo estuvo tu pedido ${num}: tu evaluación ayuda a mantener el Índice de Transparencia.`, pedido.codigo_pedido);
        await avisar(pedido.restaurante_id, 'restaurante', 'pedido_entregado', 'Pedido entregado', `El pedido ${num} se entregó con PIN correcto.`, pedido.codigo_pedido);

        res.status(200).json({
            exito: true,
            mensaje: '¡Entrega confirmada! El PIN es correcto.',
            operacion: 'updateOne() con $set',
            consultaMQL: `Pedido.updateOne({ codigo_pedido: "${pedido.codigo_pedido}" }, { $set: { estado: "Entregado" } })`,
            pedido: ocultarPin(pedido, req.usuario)
        });
    } catch (e) {
        falla(res, e, 'Error al validar el PIN');
    }
};

exports.ocultarPin = ocultarPin;
exports.COSTO_ENVIO = COSTO_ENVIO;
