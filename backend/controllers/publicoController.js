/* Endpoints públicos (sin token) para la página principal de la clínica */
import pool from "../config/db.js";
import { manejarError } from "../utils/errores.js";

const PublicoController = {

    async servicios(req, res) {
        try {
            const r = await pool.query(
                `SELECT id_servicio, nombre, categoria, descripcion, precio, duracion_min
                   FROM servicios WHERE activo ORDER BY categoria, nombre`);
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async dermatologos(req, res) {
        try {
            const r = await pool.query(
                `SELECT nombre, apellido, especialidad,
                        TO_CHAR(horario_inicio,'HH12:MI AM') AS desde, TO_CHAR(horario_fin,'HH12:MI AM') AS hasta
                   FROM dermatologos WHERE activo ORDER BY apellido`);
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async estadisticas(req, res) {
        try {
            const r = await pool.query(
                `SELECT (SELECT COUNT(*) FROM pacientes) AS pacientes,
                        (SELECT COUNT(*) FROM citas WHERE estado = 'Atendida') AS consultas,
                        (SELECT COUNT(*) FROM dermatologos WHERE activo) AS especialistas,
                        (SELECT COUNT(*) FROM servicios WHERE activo) AS servicios`);
            res.json(r.rows[0]);
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default PublicoController;
