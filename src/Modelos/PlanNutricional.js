const db = require('../config/db');

function ejecutarQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

const PlanNutricional = {
    // 2. SELECT con WHERE y ORDER BY: Planes nutricionales filtrados
    obtenerConPrecioMayorA: (precioMinimo = 20) => {
        const sql = 'SELECT * FROM PlanNutricional WHERE PrecioMensual > ? ORDER BY PrecioMensual DESC';
        return ejecutarQuery(sql, [precioMinimo]).then(data => ({ sql, data }));
    },

    // Listar todos
    obtenerTodos: () => {
        const sql = 'SELECT * FROM PlanNutricional';
        return ejecutarQuery(sql).then(data => ({ sql, data }));
    },

    // Conteo para panel de estado
    contar: () => {
        return ejecutarQuery('SELECT COUNT(*) AS total FROM PlanNutricional');
    }
};

module.exports = PlanNutricional;
