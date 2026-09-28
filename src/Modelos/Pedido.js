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

const Pedido = {
    // 5. INSERT: Registrar nuevo pedido
    crear: (idCliente = 1, idPlan = 2, total = 59.99) => {
        const sql = `INSERT INTO Pedido (Id_cliente, Id_plan, Fecha, Estado, Total) 
                     VALUES (?, ?, datetime('now','localtime'), 'En Preparación', ?)`;
        const valores = [idCliente, idPlan, total];
        return ejecutarRun(sql, valores).then(result => ({ sql, valores, result }));
    },

    // 7. UPDATE: Actualizar estado de pedido
    actualizarEstado: (idPedido = 1, nuevoEstado = 'En Camino') => {
        const sql = 'UPDATE Pedido SET Estado = ? WHERE Id_pedido = ?';
        const valores = [nuevoEstado, idPedido];
        return ejecutarRun(sql, valores).then(result => ({ sql, valores, result }));
    },

    // 8. INNER JOIN: Pedidos con detalle de Cliente y Plan
    obtenerDetallados: () => {
        const sql = `
            SELECT p.Id_pedido, p.Fecha, p.Estado, p.Total,
                   c.Nombre AS NombreCliente, c.Correo AS CorreoCliente,
                   pl.NombrePlan, pl.CaloriasDiarias, pl.Objetivo
            FROM Pedido p
            INNER JOIN Cliente c ON p.Id_cliente = c.Id_cliente
            INNER JOIN PlanNutricional pl ON p.Id_plan = pl.Id_plan
            ORDER BY p.Id_pedido DESC
        `;
        return ejecutarQuery(sql).then(data => ({ sql, data }));
    },

    // 10. DELETE: Eliminar último pedido de prueba
    eliminarUltimoPrueba: () => {
        const sql = 'DELETE FROM Pedido WHERE Id_pedido = (SELECT MAX(Id_pedido) FROM Pedido WHERE Id_pedido > 1)';
        return ejecutarRun(sql).then(result => ({ sql, result }));
    },

    // Conteo para panel de estado
    contar: () => {
        return ejecutarQuery('SELECT COUNT(*) AS total FROM Pedido');
    }
};

module.exports = Pedido;
