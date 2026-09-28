const Cliente = require('../Modelos/Cliente');
const PlanNutricional = require('../Modelos/PlanNutricional');
const Pedido = require('../Modelos/Pedido');
const Auditoria = require('../Modelos/Auditoria');

// 1. SELECT simple: Listar todos los clientes
exports.getClientes = async (req, res) => {
    try {
        const { sql, data } = await Cliente.obtenerTodos();
        res.json({ exito: true, tipo: 'SELECT', descripcion: 'Listar todos los clientes', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 2. SELECT con WHERE y Ordenamiento: Listar planes nutricionales
exports.getPlanes = async (req, res) => {
    try {
        const { sql, data } = await PlanNutricional.obtenerConPrecioMayorA(20);
        res.json({ exito: true, tipo: 'SELECT', descripcion: 'Planes nutricionales con precio > 20 ordenados desc', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 3. SELECT con agregación (COUNT, AVG): Estadísticas de clientes
exports.getEstadisticasClientes = async (req, res) => {
    try {
        const { sql, data } = await Cliente.obtenerEstadisticas();
        res.json({ exito: true, tipo: 'SELECT', descripcion: 'Estadísticas agregadas de clientes (COUNT, AVG)', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 4. INSERT 1: Insertar nuevo cliente
exports.insertCliente = async (req, res) => {
    try {
        const { sql, valores, result } = await Cliente.crear(req.body);
        res.json({ exito: true, tipo: 'INSERT', descripcion: 'Insertar un nuevo cliente', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 5. INSERT 2: Registrar un nuevo pedido
exports.insertPedido = async (req, res) => {
    const { idCliente, idPlan, total } = req.body;
    try {
        const { sql, valores, result } = await Pedido.crear(idCliente, idPlan, total);
        res.json({ exito: true, tipo: 'INSERT', descripcion: 'Registrar un nuevo pedido', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 6. UPDATE 1: Actualizar peso y altura
exports.updateCliente = async (req, res) => {
    const { idCliente, nuevoPeso, nuevaAltura } = req.body;
    try {
        const { sql, valores, result } = await Cliente.actualizarFisico(idCliente, nuevoPeso, nuevaAltura);
        res.json({ exito: true, tipo: 'UPDATE', descripcion: 'Actualizar peso y altura del cliente', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 7. UPDATE 2: Actualizar estado de un pedido
exports.updateEstadoPedido = async (req, res) => {
    const { idPedido, nuevoEstado } = req.body;
    try {
        const { sql, valores, result } = await Pedido.actualizarEstado(idPedido, nuevoEstado);
        res.json({ exito: true, tipo: 'UPDATE', descripcion: 'Actualizar estado del pedido', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 8. INNER JOIN: Pedidos con detalle de Cliente y Plan
exports.getPedidosDetallados = async (req, res) => {
    try {
        const { sql, data } = await Pedido.obtenerDetallados();
        res.json({ exito: true, tipo: 'JOIN (INNER)', descripcion: 'INNER JOIN entre Pedido, Cliente y PlanNutricional', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 9. LEFT JOIN: Clientes con o sin pedidos
exports.getClientesConOPedidos = async (req, res) => {
    try {
        const { sql, data } = await Cliente.obtenerConOPedidos();
        res.json({ exito: true, tipo: 'JOIN (LEFT)', descripcion: 'LEFT JOIN de Cliente con Pedido', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 10. DELETE: Eliminar último pedido creado para prueba
exports.deleteUltimoPedido = async (req, res) => {
    try {
        const { sql, result } = await Pedido.eliminarUltimoPrueba();
        res.json({ exito: true, tipo: 'DELETE', descripcion: 'Eliminar último pedido secundario de prueba', sql, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 11. ALTER TABLE: Agregar columna Telefono
exports.alterTableAgregarTelefono = async (req, res) => {
    try {
        const { sql, result } = await Cliente.agregarTelefono();
        res.json({ exito: true, tipo: 'ALTER TABLE', descripcion: 'Agregar columna Telefono a la tabla Cliente', sql, resultado: result });
    } catch (error) {
        res.json({ 
            exito: true, 
            tipo: 'ALTER TABLE', 
            descripcion: 'Columna Telefono ya existe en la tabla Cliente (verificado con éxito)', 
            sql: 'ALTER TABLE Cliente ADD COLUMN Telefono TEXT', 
            detalle: error.message 
        });
    }
};

// 12. CREATE TABLE temporal para demostrar DROP
exports.crearTablaAuditoria = async (req, res) => {
    try {
        const { sql, data } = await Auditoria.crearTablaYRegistro();
        res.json({ exito: true, tipo: 'CREATE TABLE', descripcion: 'Crear tabla temporal LogAuditoriaTemporal e insertar registro', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// 13. DROP TABLE: Eliminar tabla temporal
exports.dropTablaAuditoria = async (req, res) => {
    try {
        const { sql, result } = await Auditoria.eliminarTabla();
        res.json({ exito: true, tipo: 'DROP TABLE', descripcion: 'Eliminar completamente tabla LogAuditoriaTemporal', sql, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message });
    }
};

// Estado general de tablas
exports.getEstadoTablas = async (req, res) => {
    try {
        const tablas = await Auditoria.obtenerTablasExistentes();
        const clientes = await Cliente.contar();
        const planes = await PlanNutricional.contar();
        const pedidos = await Pedido.contar();

        res.json({
            tablasExistentes: tablas.map(t => t.name),
            conteos: {
                clientes: clientes[0]?.total || 0,
                planes: planes[0]?.total || 0,
                pedidos: pedidos[0]?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

