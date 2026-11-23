import pool from "../config/db.js";
import { manejarError, requerir, errorHttp } from "../utils/errores.js";

const CAMPOS = ["cedula", "nombre", "apellido", "fecha_nacimiento", "sexo", "telefono",
                "correo", "direccion", "tipo_piel", "alergias", "seguro_medico"];

function limpiar(body) {
    const p = {};
    CAMPOS.forEach((c) => {
        const v = body[c];
        p[c] = v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim();
    });
    if (p.cedula && !/^\d{3}-\d{7}-\d$/.test(p.cedula)) {
        throw errorHttp(400, "La cédula debe tener el formato 000-0000000-0.");
    }
    if (p.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo)) {
        throw errorHttp(400, "El correo electrónico no es válido.");
    }
    p.tipo_piel = p.tipo_piel || "III";
    p.seguro_medico = p.seguro_medico || "Ninguno";
    return p;
}

const PacientesController = {

    // GET /api/pacientes?buscar=texto
    async listar(req, res) {
        try {
            const buscar = (req.query.buscar || "").trim();
            const r = await pool.query(
                `SELECT p.*,
                        DATE_PART('year', AGE(p.fecha_nacimiento))::int AS edad,
                        (SELECT COUNT(*) FROM citas c WHERE c.id_paciente = p.id_paciente) AS total_citas
                   FROM pacientes p
                  WHERE $1 = ''
                     OR p.cedula ILIKE '%' || $1 || '%'
                     OR (p.nombre || ' ' || p.apellido) ILIKE '%' || $1 || '%'
                     OR p.telefono ILIKE '%' || $1 || '%'
                  ORDER BY p.apellido, p.nombre`,
                [buscar]
            );
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    // GET /api/pacientes/:id  (incluye historial clínico)
    async buscar(req, res) {
        try {
            const r = await pool.query(
                `SELECT p.*, DATE_PART('year', AGE(p.fecha_nacimiento))::int AS edad
                   FROM pacientes p WHERE p.id_paciente = $1`,
                [req.params.id]
            );
            if (!r.rows[0]) throw errorHttp(404, "Paciente no encontrado.");

            const historial = await pool.query(
                `SELECT c.id_cita, c.fecha, c.hora, c.estado, c.motivo,
                        s.nombre AS servicio,
                        d.nombre || ' ' || d.apellido AS dermatologo,
                        co.diagnostico, co.tratamiento, co.id_consulta
                   FROM citas c
                   JOIN servicios s     ON s.id_servicio = c.id_servicio
                   JOIN dermatologos d  ON d.id_dermatologo = c.id_dermatologo
                   LEFT JOIN consultas co ON co.id_cita = c.id_cita
                  WHERE c.id_paciente = $1
                  ORDER BY c.fecha DESC, c.hora DESC`,
                [req.params.id]
            );
            res.json({ ...r.rows[0], historial: historial.rows });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // POST /api/pacientes
    async crear(req, res) {
        try {
            requerir(req.body, ["cedula", "nombre", "apellido", "fecha_nacimiento", "sexo", "telefono"]);
            const p = limpiar(req.body);
            const r = await pool.query(
                `INSERT INTO pacientes (${CAMPOS.join(", ")})
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
                CAMPOS.map((c) => p[c])
            );
            res.status(201).json({ mensaje: "Paciente registrado correctamente.", datos: r.rows[0] });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // PUT /api/pacientes/:id
    async actualizar(req, res) {
        try {
            requerir(req.body, ["cedula", "nombre", "apellido", "fecha_nacimiento", "sexo", "telefono"]);
            const p = limpiar(req.body);
            const r = await pool.query(
                `UPDATE pacientes SET ${CAMPOS.map((c, i) => `${c} = $${i + 1}`).join(", ")}
                  WHERE id_paciente = $${CAMPOS.length + 1} RETURNING *`,
                [...CAMPOS.map((c) => p[c]), req.params.id]
            );
            if (!r.rows[0]) throw errorHttp(404, "Paciente no encontrado.");
            res.json({ mensaje: "Paciente actualizado correctamente.", datos: r.rows[0] });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // DELETE /api/pacientes/:id
    async eliminar(req, res) {
        try {
            const citas = await pool.query("SELECT COUNT(*) AS n FROM citas WHERE id_paciente = $1", [req.params.id]);
            if (citas.rows[0].n > 0) {
                throw errorHttp(409, `No se puede eliminar: el paciente tiene ${citas.rows[0].n} cita(s) en su historial.`);
            }
            const r = await pool.query("DELETE FROM pacientes WHERE id_paciente = $1", [req.params.id]);
            if (!r.rowCount) throw errorHttp(404, "Paciente no encontrado.");
            res.json({ mensaje: "Paciente eliminado correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default PacientesController;
