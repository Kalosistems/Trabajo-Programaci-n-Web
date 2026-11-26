/**
 * Libro de pagos en PostgreSQL (RNF-07). Cada comprobante de la pasarela se registra una sola vez:
 * la columna referencia es UNIQUE, así un mismo pago no se puede usar para dos pedidos.
 */
const { consultar } = require('../../config/postgres');

class PagoRepetido extends Error {}

async function registrarPago({ referencia, cuentaId, codigoPedido, concepto, monto, moneda, metodo, marca, ultimos4 }) {
    try {
        const { rows } = await consultar(
            `INSERT INTO pagos (referencia, cuenta_id, codigo_pedido, concepto, monto, moneda, metodo, marca, ultimos4)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, referencia, estado, creado_en`,
            [referencia, cuentaId, codigoPedido, concepto, monto, moneda, metodo, marca, ultimos4]
        );
        return rows[0];
    } catch (e) {
        if (e.code === '23505') throw new PagoRepetido('Este comprobante de pago ya se usó.'); // unique_violation
        throw e;
    }
}

// Si el pedido no se pudo guardar en MongoDB, se deshace el registro del pago
async function anularRegistro(referencia) {
    await consultar('DELETE FROM pagos WHERE referencia = $1', [referencia]);
}

async function marcarReembolsado(codigoPedido) {
    await consultar("UPDATE pagos SET estado = 'Reembolsado' WHERE codigo_pedido = $1", [codigoPedido]);
}

// Resumen de ventas de un restaurante (los códigos de sus pedidos vienen de MongoDB)
async function resumenPorPedidos(codigos) {
    if (!codigos.length) return { pagos: 0, aprobado: 0, reembolsado: 0 };
    const { rows } = await consultar(
        `SELECT COUNT(*)::int AS pagos,
                COALESCE(SUM(monto) FILTER (WHERE estado = 'Aprobado'), 0)::float AS aprobado,
                COALESCE(SUM(monto) FILTER (WHERE estado = 'Reembolsado'), 0)::float AS reembolsado
           FROM pagos
          WHERE codigo_pedido = ANY($1::varchar[])`,
        [codigos]
    );
    return rows[0];
}

module.exports = { registrarPago, anularRegistro, marcarReembolsado, resumenPorPedidos, PagoRepetido };
