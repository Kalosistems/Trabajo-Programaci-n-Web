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

const Cliente = {
    // Buscar cliente por credenciales (Login)
    buscarPorCredenciales: (correo, password) => {
        const sql = 'SELECT * FROM Cliente WHERE Correo = ? AND Password = ?';
        return ejecutarQuery(sql, [correo, password]);
    },

    // 1. SELECT simple: Listar todos los clientes
    obtenerTodos: () => {
        const sql = 'SELECT Id_cliente, Nombre, Correo, Peso, Altura, Edad, Genero FROM Cliente';
        return ejecutarQuery(sql).then(data => ({ sql, data }));
    },

    // 3. SELECT con agregación: Estadísticas
    obtenerEstadisticas: () => {
        const sql = 'SELECT COUNT(*) AS TotalClientes, AVG(Peso) AS PesoPromedio, AVG(Altura) AS AlturaPromedio FROM Cliente';
        return ejecutarQuery(sql).then(data => ({ sql, data }));
    },

    // 4. INSERT: Registrar nuevo cliente
    crear: (datos) => {
        const sql = `INSERT INTO Cliente (Nombre, Correo, Password, Peso, Altura, Edad, Genero) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const valores = [
            datos.nombre || 'Carlos Mendoza',
            datos.correo || `carlos_${Date.now()}@mail.com`,
            datos.password || 'clave1234',
            datos.peso || 75.0,
            datos.altura || 1.78,
            datos.edad || 31,
            datos.genero || 'Masculino'
        ];
        return ejecutarRun(sql, valores).then(result => ({ sql, valores, result }));
    },

    // 6. UPDATE: Actualizar datos físicos
    actualizarFisico: (idCliente, peso, altura) => {
        const sql = 'UPDATE Cliente SET Peso = ?, Altura = ? WHERE Id_cliente = ?';
        const valores = [peso || 70.2, altura || 1.66, idCliente || 1];
        return ejecutarRun(sql, valores).then(result => ({ sql, valores, result }));
    },

    // 9. LEFT JOIN: Clientes con o sin pedidos
    obtenerConOPedidos: () => {
        const sql = `
            SELECT c.Id_cliente, c.Nombre, c.Correo,
                   p.Id_pedido, p.Estado AS EstadoPedido, p.Total
            FROM Cliente c
            LEFT JOIN Pedido p ON c.Id_cliente = p.Id_cliente
            ORDER BY c.Id_cliente ASC
        `;
        return ejecutarQuery(sql).then(data => ({ sql, data }));
    },

    // 11. ALTER TABLE: Agregar columna Telefono
    agregarTelefono: () => {
        const sql = 'ALTER TABLE Cliente ADD COLUMN Telefono TEXT';
        return ejecutarRun(sql).then(result => ({ sql, result }));
    },

    // Conteo para panel de estado
    contar: () => {
        return ejecutarQuery('SELECT COUNT(*) AS total FROM Cliente');
    }
};

module.exports = Cliente;
