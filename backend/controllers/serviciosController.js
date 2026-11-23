import pool from "../config/db.js";
import { manejarError, requerir, errorHttp } from "../utils/errores.js";

function limpiar(body) {
    const precio = Number(body.precio);
    const duracion = parseInt(body.duracion_min, 10);
    if (isNaN(precio) || precio < 0) throw errorHttp(400, "El precio debe ser un número mayor o igual a 0.");
    if (isNaN(duracion) || duracion < 10 || duracion > 240) throw errorHttp(400, "La duración debe estar entre 10 y 240 minutos.");
    return [
        String(body.nombre).trim(),
        body.categoria,
        body.descripcion ? String(body.descripcion).trim() : null,
        precio,
        duracion,
        !(body.activo === false || body.activo === "false")
    ];
}

const ServiciosController = {

    async listar(req, res) {
        try {
            const soloActivos = req.query.activos === "1";
            const r = await pool.query(
                `SELECT s.*,
                        (SELECT COUNT(*) FROM citas c WHERE c.id_servicio = s.id_servicio) AS veces_solicitado
                   FROM servicios s
                  WHERE ($1 = false OR s.activo = true)
                  ORDER BY s.categoria, s.nombre`,
                [soloActivos]
            );
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async buscar(req, res) {
        try {
            const r = await pool.query("SELECT * FROM servicios WHERE id_servicio = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Servicio no encontrado.");
            res.json(r.rows[0]);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async crear(req, res) {
        try {
            requerir(req.body, ["nombre", "categoria", "precio", "duracion_min"]);
            const r = await pool.query(
                `INSERT INTO servicios (nombre, categoria, descripcion, precio, duracion_min, activo)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                limpiar(req.body)
            );
            res.status(201).json({ mensaje: "Servicio registrado correctamente.", datos: r.rows[0] });
        } catch (error) {
            manejarError(res, error);
        }
    },

    async actualizar(req, res) {
        try {
            requerir(req.body, ["nombre", "categoria", "precio", "duracion_min"]);
            const r = await pool.query(
                `UPDATE servicios
                    SET nombre=$1, categoria=$2, descripcion=$3, precio=$4, duracion_min=$5, activo=$6
                  WHERE id_servicio=$7 RETURNING *`,
                [...limpiar(req.body), req.params.id]
            );
            if (!r.rows[0]) throw errorHttp(404, "Servicio no encontrado.");
            res.json({ mensaje: "Servicio actualizado correctamente.", datos: r.rows[0] });
        } catch (error) {
            manejarError(res, error);
        }
    },

    async eliminar(req, res) {
        try {
            const citas = await pool.query("SELECT COUNT(*) AS n FROM citas WHERE id_servicio = $1", [req.params.id]);
            if (citas.rows[0].n > 0) {
                throw errorHttp(409, `No se puede eliminar: el servicio se usó en ${citas.rows[0].n} cita(s). Puede desactivarlo.`);
            }
            const r = await pool.query("DELETE FROM servicios WHERE id_servicio = $1", [req.params.id]);
            if (!r.rowCount) throw errorHttp(404, "Servicio no encontrado.");
            res.json({ mensaje: "Servicio eliminado correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default ServiciosController;
