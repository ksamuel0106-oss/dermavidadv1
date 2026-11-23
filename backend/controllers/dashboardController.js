import pool from "../config/db.js";
import { manejarError, hoyISO } from "../utils/errores.js";

const DashboardController = {

    // GET /api/dashboard
    async resumen(req, res) {
        try {
            const hoy = hoyISO();
            const mes = hoy.slice(0, 7);
            const idDerm = req.usuario.rol === "Dermatólogo" ? req.usuario.id_dermatologo : null;

            const [kpi, citasHoy, porEstado, ingresosMeses, topServicios, proximos] = await Promise.all([
                pool.query(`
                    SELECT (SELECT COUNT(*) FROM pacientes) AS pacientes,
                           (SELECT COUNT(*) FROM pacientes WHERE TO_CHAR(creado_en,'YYYY-MM') = $2) AS pacientes_mes,
                           (SELECT COUNT(*) FROM citas WHERE fecha = $1 AND estado <> 'Cancelada') AS citas_hoy,
                           (SELECT COUNT(*) FROM citas WHERE fecha = $1 AND estado IN ('Pendiente','Confirmada')) AS por_atender_hoy,
                           (SELECT COUNT(*) FROM citas WHERE TO_CHAR(fecha,'YYYY-MM') = $2 AND estado = 'Atendida') AS atendidas_mes,
                           (SELECT COALESCE(SUM(total),0) FROM facturas WHERE TO_CHAR(fecha,'YYYY-MM') = $2 AND estado = 'Pagada') AS ingresos_mes,
                           (SELECT COUNT(*) FROM citas WHERE fecha > $1 AND estado IN ('Pendiente','Confirmada')) AS proximas,
                           (SELECT COUNT(*) FROM dermatologos WHERE activo) AS dermatologos`, [hoy, mes]),
                pool.query(`
                    SELECT c.id_cita, TO_CHAR(c.hora,'HH24:MI') AS hora, c.estado,
                           p.nombre || ' ' || p.apellido AS paciente, s.nombre AS servicio,
                           d.nombre || ' ' || d.apellido AS dermatologo
                      FROM citas c
                      JOIN pacientes p ON p.id_paciente = c.id_paciente
                      JOIN servicios s ON s.id_servicio = c.id_servicio
                      JOIN dermatologos d ON d.id_dermatologo = c.id_dermatologo
                     WHERE c.fecha = $1 AND ($2::int IS NULL OR c.id_dermatologo = $2::int)
                     ORDER BY c.hora`, [hoy, idDerm]),
                pool.query(`SELECT estado, COUNT(*) AS total FROM citas
                             WHERE fecha >= ($1::date - INTERVAL '30 days') GROUP BY estado`, [hoy]),
                pool.query(`
                    SELECT TO_CHAR(m, 'YYYY-MM') AS mes,
                           COALESCE((SELECT SUM(total) FROM facturas f
                                      WHERE f.estado='Pagada' AND DATE_TRUNC('month', f.fecha) = m), 0) AS total
                      FROM GENERATE_SERIES(DATE_TRUNC('month', $1::date) - INTERVAL '5 months',
                                           DATE_TRUNC('month', $1::date), INTERVAL '1 month') AS m
                     ORDER BY m`, [hoy]),
                pool.query(`
                    SELECT s.nombre, COUNT(*) AS total
                      FROM citas c JOIN servicios s ON s.id_servicio = c.id_servicio
                     WHERE c.estado = 'Atendida'
                     GROUP BY s.nombre ORDER BY total DESC LIMIT 5`),
                pool.query(`
                    SELECT c.fecha, TO_CHAR(c.hora,'HH24:MI') AS hora, c.estado,
                           p.nombre || ' ' || p.apellido AS paciente, s.nombre AS servicio
                      FROM citas c
                      JOIN pacientes p ON p.id_paciente = c.id_paciente
                      JOIN servicios s ON s.id_servicio = c.id_servicio
                     WHERE c.fecha > $1 AND c.estado IN ('Pendiente','Confirmada')
                       AND ($2::int IS NULL OR c.id_dermatologo = $2::int)
                     ORDER BY c.fecha, c.hora LIMIT 6`, [hoy, idDerm])
            ]);

            res.json({
                hoy,
                kpi: kpi.rows[0],
                citasHoy: citasHoy.rows,
                porEstado: porEstado.rows,
                ingresosMeses: ingresosMeses.rows,
                topServicios: topServicios.rows,
                proximas: proximos.rows
            });
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default DashboardController;
