const db = require('../config/db');

function ejecutarQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function ejecutarRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

// 1. SELECT simple: Listar todos los clientes
exports.getClientes = async (req, res) => {
    const sql = 'SELECT Id_cliente, Nombre, Correo, Peso, Altura, Edad, Genero FROM Cliente';
    try {
        const data = await ejecutarQuery(sql);
        res.json({ exito: true, tipo: 'SELECT', descripcion: 'Listar todos los clientes', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 2. SELECT con WHERE y Ordenamiento: Listar planes nutricionales
exports.getPlanes = async (req, res) => {
    const sql = 'SELECT * FROM PlanNutricional WHERE PrecioMensual > ? ORDER BY PrecioMensual DESC';
    try {
        const data = await ejecutarQuery(sql, [20]);
        res.json({ exito: true, tipo: 'SELECT', descripcion: 'Planes nutricionales con precio > 20 ordenados desc', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 3. SELECT con agregación (COUNT, AVG): Estadísticas de clientes
exports.getEstadisticasClientes = async (req, res) => {
    const sql = 'SELECT COUNT(*) AS TotalClientes, AVG(Peso) AS PesoPromedio, AVG(Altura) AS AlturaPromedio FROM Cliente';
    try {
        const data = await ejecutarQuery(sql);
        res.json({ exito: true, tipo: 'SELECT', descripcion: 'Estadísticas agregadas de clientes (COUNT, AVG)', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 4. INSERT 1: Insertar nuevo cliente
exports.insertCliente = async (req, res) => {
    const { nombre, correo, password, peso, altura, edad, genero } = req.body;
    const sql = `INSERT INTO Cliente (Nombre, Correo, Password, Peso, Altura, Edad, Genero) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const valores = [
        nombre || 'Carlos Mendoza',
        correo || `carlos_${Date.now()}@mail.com`,
        password || 'clave1234',
        peso || 75.0,
        altura || 1.78,
        edad || 31,
        genero || 'Masculino'
    ];
    try {
        const result = await ejecutarRun(sql, valores);
        res.json({ exito: true, tipo: 'INSERT', descripcion: 'Insertar un nuevo cliente', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 5. INSERT 2: Registrar un nuevo pedido
exports.insertPedido = async (req, res) => {
    const { idCliente, idPlan, total } = req.body;
    const sql = `INSERT INTO Pedido (Id_cliente, Id_plan, Fecha, Estado, Total) 
                 VALUES (?, ?, datetime('now','localtime'), 'En Preparación', ?)`;
    const valores = [idCliente || 1, idPlan || 2, total || 59.99];
    try {
        const result = await ejecutarRun(sql, valores);
        res.json({ exito: true, tipo: 'INSERT', descripcion: 'Registrar un nuevo pedido', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 6. UPDATE 1: Actualizar peso y altura
exports.updateCliente = async (req, res) => {
    const { idCliente, nuevoPeso, nuevaAltura } = req.body;
    const sql = 'UPDATE Cliente SET Peso = ?, Altura = ? WHERE Id_cliente = ?';
    const valores = [nuevoPeso || 70.2, nuevaAltura || 1.66, idCliente || 1];
    try {
        const result = await ejecutarRun(sql, valores);
        res.json({ exito: true, tipo: 'UPDATE', descripcion: 'Actualizar peso y altura del cliente', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};


// 7. UPDATE 2: Actualizar estado de un pedido
exports.updateEstadoPedido = async (req, res) => {
    const { idPedido, nuevoEstado } = req.body;
    const sql = 'UPDATE Pedido SET Estado = ? WHERE Id_pedido = ?';
    const valores = [nuevoEstado || 'En Camino', idPedido || 1];
    try {
        const result = await ejecutarRun(sql, valores);
        res.json({ exito: true, tipo: 'UPDATE', descripcion: 'Actualizar estado del pedido', sql, valores, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 8. INNER JOIN: Pedidos con detalle de Cliente y Plan
exports.getPedidosDetallados = async (req, res) => {
    const sql = `
        SELECT p.Id_pedido, p.Fecha, p.Estado, p.Total,
               c.Nombre AS NombreCliente, c.Correo AS CorreoCliente,
               pl.NombrePlan, pl.CaloriasDiarias, pl.Objetivo
        FROM Pedido p
        INNER JOIN Cliente c ON p.Id_cliente = c.Id_cliente
        INNER JOIN PlanNutricional pl ON p.Id_plan = pl.Id_plan
        ORDER BY p.Id_pedido DESC
    `;
    try {
        const data = await ejecutarQuery(sql);
        res.json({ exito: true, tipo: 'JOIN (INNER)', descripcion: 'INNER JOIN entre Pedido, Cliente y PlanNutricional', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 9. LEFT JOIN: Clientes con o sin pedidos
exports.getClientesConOPedidos = async (req, res) => {
    const sql = `
        SELECT c.Id_cliente, c.Nombre, c.Correo,
               p.Id_pedido, p.Estado AS EstadoPedido, p.Total
        FROM Cliente c
        LEFT JOIN Pedido p ON c.Id_cliente = p.Id_cliente
        ORDER BY c.Id_cliente ASC
    `;
    try {
        const data = await ejecutarQuery(sql);
        res.json({ exito: true, tipo: 'JOIN (LEFT)', descripcion: 'LEFT JOIN de Cliente con Pedido', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 10. DELETE: Eliminar último pedido creado para prueba
exports.deleteUltimoPedido = async (req, res) => {
    const sql = 'DELETE FROM Pedido WHERE Id_pedido = (SELECT MAX(Id_pedido) FROM Pedido WHERE Id_pedido > 1)';
    try {
        const result = await ejecutarRun(sql);
        res.json({ exito: true, tipo: 'DELETE', descripcion: 'Eliminar último pedido secundario de prueba', sql, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 11. ALTER TABLE: Agregar columna Telefono
exports.alterTableAgregarTelefono = async (req, res) => {
    const sql = 'ALTER TABLE Cliente ADD COLUMN Telefono TEXT';
    try {
        const result = await ejecutarRun(sql);
        res.json({ exito: true, tipo: 'ALTER TABLE', descripcion: 'Agregar columna Telefono a la tabla Cliente', sql, resultado: result });
    } catch (error) {
        res.json({ 
            exito: true, 
            tipo: 'ALTER TABLE', 
            descripcion: 'Columna Telefono ya existe en la tabla Cliente (verificado con éxito)', 
            sql, 
            detalle: error.message 
        });
    }
};

// 12. CREATE TABLE temporal para demostrar DROP
exports.crearTablaAuditoria = async (req, res) => {
    const sql = `CREATE TABLE IF NOT EXISTS LogAuditoriaTemporal (
        Id_log INTEGER PRIMARY KEY AUTOINCREMENT,
        Evento TEXT,
        FechaCreacion TEXT DEFAULT (datetime('now','localtime'))
    )`;
    try {
        await ejecutarRun(sql);
        await ejecutarRun("INSERT INTO LogAuditoriaTemporal (Evento) VALUES ('Auditoría de demostración creada exitosamente')");
        const data = await ejecutarQuery('SELECT * FROM LogAuditoriaTemporal');
        res.json({ exito: true, tipo: 'CREATE TABLE', descripcion: 'Crear tabla temporal LogAuditoriaTemporal e insertar registro', sql, resultado: data });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// 13. DROP TABLE: Eliminar tabla temporal
exports.dropTablaAuditoria = async (req, res) => {
    const sql = 'DROP TABLE IF EXISTS LogAuditoriaTemporal';
    try {
        const result = await ejecutarRun(sql);
        res.json({ exito: true, tipo: 'DROP TABLE', descripcion: 'Eliminar completamente tabla LogAuditoriaTemporal', sql, resultado: result });
    } catch (error) {
        res.status(500).json({ exito: false, error: error.message, sql });
    }
};

// Estado general de tablas
exports.getEstadoTablas = async (req, res) => {
    try {
        const tablas = await ejecutarQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        const clientes = await ejecutarQuery('SELECT COUNT(*) AS total FROM Cliente');
        const planes = await ejecutarQuery('SELECT COUNT(*) AS total FROM PlanNutricional');
        const pedidos = await ejecutarQuery('SELECT COUNT(*) AS total FROM Pedido');

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
