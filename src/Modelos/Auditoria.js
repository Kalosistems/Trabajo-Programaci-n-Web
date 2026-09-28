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

const Auditoria = {
    // 12. CREATE TABLE temporal e INSERT
    crearTablaYRegistro: async () => {
        const sqlCreate = `CREATE TABLE IF NOT EXISTS LogAuditoriaTemporal (
            Id_log INTEGER PRIMARY KEY AUTOINCREMENT,
            Evento TEXT,
            FechaCreacion TEXT DEFAULT (datetime('now','localtime'))
        )`;
        await ejecutarRun(sqlCreate);
        await ejecutarRun("INSERT INTO LogAuditoriaTemporal (Evento) VALUES ('Auditoría de demostración creada exitosamente')");
        const data = await ejecutarQuery('SELECT * FROM LogAuditoriaTemporal');
        return { sql: sqlCreate, data };
    },

    // 13. DROP TABLE temporal
    eliminarTabla: () => {
        const sql = 'DROP TABLE IF EXISTS LogAuditoriaTemporal';
        return ejecutarRun(sql).then(result => ({ sql, result }));
    },

    // Listar nombres de tablas existentes
    obtenerTablasExistentes: () => {
        const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
        return ejecutarQuery(sql);
    }
};

module.exports = Auditoria;
