import pool from "../config/db.js";
import { manejarError, requerir, errorHttp } from "../utils/errores.js";

const CAMPOS = ["nombre", "apellido", "especialidad", "exequatur", "telefono", "correo",
                "horario_inicio", "horario_fin", "activo"];

function limpiar(body) {
    const d = {};
    CAMPOS.forEach((c) => {
        const v = body[c];
        d[c] = v === undefined || v === null || String(v).trim() === "" ? null : (typeof v === "string" ? v.trim() : v);
    });
    d.activo = !(body.activo === false || body.activo === "false");
    d.horario_inicio = d.horario_inicio || "08:00";
    d.horario_fin = d.horario_fin || "17:00";
    if (d.horario_fin <= d.horario_inicio) throw errorHttp(400, "La hora de salida debe ser mayor que la de entrada.");
    return d;
}

const DermatologosController = {

    async listar(req, res) {
        try {
            const soloActivos = req.query.activos === "1";
            const r = await pool.query(
                `SELECT d.*,
                        (SELECT COUNT(*) FROM citas c WHERE c.id_dermatologo = d.id_dermatologo AND c.estado = 'Atendida') AS atendidas,
                        (SELECT COUNT(*) FROM citas c WHERE c.id_dermatologo = d.id_dermatologo
                            AND c.estado IN ('Pendiente','Confirmada') AND c.fecha >= CURRENT_DATE) AS proximas
                   FROM dermatologos d
                  WHERE ($1 = false OR d.activo = true)
                  ORDER BY d.apellido, d.nombre`,
                [soloActivos]
            );
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async buscar(req, res) {
        try {
            const r = await pool.query("SELECT * FROM dermatologos WHERE id_dermatologo = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Dermatólogo no encontrado.");
            res.json(r.rows[0]);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async crear(req, res) {
        try {
            requerir(req.body, ["nombre", "apellido", "especialidad", "exequatur"]);
            const d = limpiar(req.body);
            const r = await pool.query(
                `INSERT INTO dermatologos (${CAMPOS.join(", ")})
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
                CAMPOS.map((c) => d[c])
            );
            res.status(201).json({ mensaje: "Dermatólogo registrado correctamente.", datos: r.rows[0] });
        } catch (error) {
            manejarError(res, error);
        }
    },

    async actualizar(req, res) {
        try {
            requerir(req.body, ["nombre", "apellido", "especialidad", "exequatur"]);
            const d = limpiar(req.body);
            const r = await pool.query(
                `UPDATE dermatologos SET ${CAMPOS.map((c, i) => `${c} = $${i + 1}`).join(", ")}
                  WHERE id_dermatologo = $${CAMPOS.length + 1} RETURNING *`,
                [...CAMPOS.map((c) => d[c]), req.params.id]
            );
            if (!r.rows[0]) throw errorHttp(404, "Dermatólogo no encontrado.");
            res.json({ mensaje: "Dermatólogo actualizado correctamente.", datos: r.rows[0] });
        } catch (error) {
            manejarError(res, error);
        }
    },

    async eliminar(req, res) {
        try {
            const citas = await pool.query("SELECT COUNT(*) AS n FROM citas WHERE id_dermatologo = $1", [req.params.id]);
            if (citas.rows[0].n > 0) {
                throw errorHttp(409, `No se puede eliminar: tiene ${citas.rows[0].n} cita(s) registradas. Puede marcarlo como inactivo.`);
            }
            const r = await pool.query("DELETE FROM dermatologos WHERE id_dermatologo = $1", [req.params.id]);
            if (!r.rowCount) throw errorHttp(404, "Dermatólogo no encontrado.");
            res.json({ mensaje: "Dermatólogo eliminado correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default DermatologosController;
