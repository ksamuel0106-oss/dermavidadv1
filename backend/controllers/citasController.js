/*
 * =====================================================================
 *  PROCESO 1: AGENDAMIENTO DE CITAS
 * =====================================================================
 *  Reglas de negocio:
 *   1. El paciente, el dermatólogo y el servicio deben existir y estar activos.
 *   2. No se agenda en fechas/horas pasadas ni los domingos.
 *   3. La cita (hora + duración del servicio) debe caber en el horario del dermatólogo.
 *   4. El dermatólogo no puede tener otra cita que se solape en ese horario.
 *   5. El paciente no puede tener dos citas solapadas el mismo día.
 *   6. Flujo de estados: Pendiente -> Confirmada -> Atendida (vía consulta)
 *                        Pendiente/Confirmada -> Cancelada
 * =====================================================================
 */
import pool from "../config/db.js";
import { manejarError, requerir, errorHttp, hoyISO, aMinutos, aHora } from "../utils/errores.js";

const SELECT_CITAS = `
    SELECT c.id_cita, c.fecha, TO_CHAR(c.hora, 'HH24:MI') AS hora, c.motivo, c.estado, c.creado_en,
           c.id_paciente, c.id_dermatologo, c.id_servicio,
           p.nombre || ' ' || p.apellido AS paciente, p.cedula, p.telefono, p.seguro_medico,
           d.nombre || ' ' || d.apellido AS dermatologo, d.especialidad,
           s.nombre AS servicio, s.precio, s.duracion_min, s.categoria,
           TO_CHAR(c.hora + (s.duracion_min || ' minutes')::interval, 'HH24:MI') AS hora_fin,
           co.id_consulta, f.id_factura, f.numero AS factura
      FROM citas c
      JOIN pacientes p     ON p.id_paciente = c.id_paciente
      JOIN dermatologos d  ON d.id_dermatologo = c.id_dermatologo
      JOIN servicios s     ON s.id_servicio = c.id_servicio
      LEFT JOIN consultas co ON co.id_cita = c.id_cita
      LEFT JOIN facturas f   ON f.id_cita = c.id_cita`;

/* Valida todas las reglas del proceso de agendamiento */
async function validarCita(cliente, datos, idExcluir = 0) {
    const { id_paciente, id_dermatologo, id_servicio, fecha, hora } = datos;

    const pac = await cliente.query("SELECT id_paciente FROM pacientes WHERE id_paciente = $1", [id_paciente]);
    if (!pac.rows[0]) throw errorHttp(400, "El paciente seleccionado no existe.");

    // Bloquea la fila del dermatólogo para evitar que dos usuarios reserven el mismo horario a la vez
    const der = await cliente.query(
        `SELECT *, TO_CHAR(horario_inicio,'HH24:MI') AS hi, TO_CHAR(horario_fin,'HH24:MI') AS hf
           FROM dermatologos WHERE id_dermatologo = $1 FOR UPDATE`,
        [id_dermatologo]
    );
    const dermatologo = der.rows[0];
    if (!dermatologo) throw errorHttp(400, "El dermatólogo seleccionado no existe.");
    if (!dermatologo.activo) throw errorHttp(400, "El dermatólogo seleccionado está inactivo.");

    const ser = await cliente.query("SELECT * FROM servicios WHERE id_servicio = $1", [id_servicio]);
    const servicio = ser.rows[0];
    if (!servicio) throw errorHttp(400, "El servicio seleccionado no existe.");
    if (!servicio.activo) throw errorHttp(400, "El servicio seleccionado no está disponible.");

    // Fecha y hora válidas
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw errorHttp(400, "Fecha inválida.");
    if (!/^\d{2}:\d{2}/.test(hora)) throw errorHttp(400, "Hora inválida.");
    const hoy = hoyISO();
    if (fecha < hoy) throw errorHttp(400, "No se pueden agendar citas en fechas pasadas.");
    if (new Date(fecha + "T12:00:00").getDay() === 0) throw errorHttp(400, "La clínica no atiende los domingos.");

    const inicio = aMinutos(hora);
    const fin = inicio + servicio.duracion_min;
    if (fecha === hoy) {
        const ahora = new Date();
        if (inicio <= ahora.getHours() * 60 + ahora.getMinutes()) {
            throw errorHttp(400, "La hora seleccionada ya pasó.");
        }
    }

    if (inicio < aMinutos(dermatologo.hi) || fin > aMinutos(dermatologo.hf)) {
        throw errorHttp(400, `Fuera del horario del dermatólogo (${dermatologo.hi} - ${dermatologo.hf}). `
            + `El servicio dura ${servicio.duracion_min} min y terminaría a las ${aHora(fin)}.`);
    }

    // Choques con otras citas del mismo dermatólogo
    const choqueDerm = await cliente.query(
        `SELECT TO_CHAR(c.hora,'HH24:MI') AS hora, s.duracion_min, p.nombre || ' ' || p.apellido AS paciente
           FROM citas c
           JOIN servicios s ON s.id_servicio = c.id_servicio
           JOIN pacientes p ON p.id_paciente = c.id_paciente
          WHERE c.id_dermatologo = $1 AND c.fecha = $2 AND c.estado <> 'Cancelada' AND c.id_cita <> $3`,
        [id_dermatologo, fecha, idExcluir]
    );
    for (const c of choqueDerm.rows) {
        const ci = aMinutos(c.hora), cf = ci + c.duracion_min;
        if (inicio < cf && ci < fin) {
            throw errorHttp(409, `El dermatólogo ya tiene una cita de ${c.hora} a ${aHora(cf)}. Elija otro horario.`);
        }
    }

    // Choques con otras citas del mismo paciente
    const choquePac = await cliente.query(
        `SELECT TO_CHAR(c.hora,'HH24:MI') AS hora, s.duracion_min
           FROM citas c JOIN servicios s ON s.id_servicio = c.id_servicio
          WHERE c.id_paciente = $1 AND c.fecha = $2 AND c.estado <> 'Cancelada' AND c.id_cita <> $3`,
        [id_paciente, fecha, idExcluir]
    );
    for (const c of choquePac.rows) {
        const ci = aMinutos(c.hora), cf = ci + c.duracion_min;
        if (inicio < cf && ci < fin) {
            throw errorHttp(409, `El paciente ya tiene otra cita ese día de ${c.hora} a ${aHora(cf)}.`);
        }
    }

    return { dermatologo, servicio };
}

const CitasController = {

    // GET /api/citas?desde=&hasta=&estado=&id_dermatologo=&buscar=
    async listar(req, res) {
        try {
            const { desde = "", hasta = "", estado = "", id_dermatologo = "", buscar = "" } = req.query;
            const r = await pool.query(
                `${SELECT_CITAS}
                  WHERE ($1 = '' OR c.fecha >= $1::date)
                    AND ($2 = '' OR c.fecha <= $2::date)
                    AND ($3 = '' OR c.estado = $3)
                    AND ($4 = '' OR c.id_dermatologo = $4::int)
                    AND ($5 = '' OR (p.nombre || ' ' || p.apellido) ILIKE '%' || $5 || '%' OR p.cedula ILIKE '%' || $5 || '%')
                  ORDER BY c.fecha DESC, c.hora DESC
                  LIMIT 500`,
                [desde, hasta, estado, String(id_dermatologo), buscar.trim()]
            );
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async buscar(req, res) {
        try {
            const r = await pool.query(SELECT_CITAS + " WHERE c.id_cita = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Cita no encontrada.");
            res.json(r.rows[0]);
        } catch (error) {
            manejarError(res, error);
        }
    },

    // GET /api/citas/disponibilidad?id_dermatologo=&fecha=&id_servicio=&excluir=
    async disponibilidad(req, res) {
        try {
            requerir(req.query, ["id_dermatologo", "fecha", "id_servicio"]);
            const { id_dermatologo, fecha, id_servicio } = req.query;
            const excluir = parseInt(req.query.excluir || "0", 10);

            const der = await pool.query(
                `SELECT TO_CHAR(horario_inicio,'HH24:MI') AS hi, TO_CHAR(horario_fin,'HH24:MI') AS hf, activo
                   FROM dermatologos WHERE id_dermatologo = $1`, [id_dermatologo]);
            const ser = await pool.query("SELECT duracion_min FROM servicios WHERE id_servicio = $1", [id_servicio]);
            if (!der.rows[0] || !ser.rows[0]) throw errorHttp(404, "Dermatólogo o servicio no encontrado.");

            const duracion = ser.rows[0].duracion_min;
            const ocupadas = await pool.query(
                `SELECT TO_CHAR(c.hora,'HH24:MI') AS hora, s.duracion_min
                   FROM citas c JOIN servicios s ON s.id_servicio = c.id_servicio
                  WHERE c.id_dermatologo = $1 AND c.fecha = $2 AND c.estado <> 'Cancelada' AND c.id_cita <> $3`,
                [id_dermatologo, fecha, excluir]
            );
            const rangos = ocupadas.rows.map((o) => [aMinutos(o.hora), aMinutos(o.hora) + o.duracion_min]);

            const hoy = hoyISO();
            const ahora = new Date();
            const minutoActual = ahora.getHours() * 60 + ahora.getMinutes();
            const domingo = new Date(fecha + "T12:00:00").getDay() === 0;

            const horarios = [];
            for (let t = aMinutos(der.rows[0].hi); t + duracion <= aMinutos(der.rows[0].hf); t += 30) {
                let disponible = !domingo && fecha >= hoy && der.rows[0].activo;
                if (fecha === hoy && t <= minutoActual) disponible = false;
                if (rangos.some(([a, b]) => t < b && a < t + duracion)) disponible = false;
                horarios.push({ hora: aHora(t), disponible });
            }
            res.json({ fecha, duracion, domingo, horario: `${der.rows[0].hi} - ${der.rows[0].hf}`, horarios });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // POST /api/citas
    async crear(req, res) {
        const cliente = await pool.connect();
        try {
            requerir(req.body, ["id_paciente", "id_dermatologo", "id_servicio", "fecha", "hora"]);
            await cliente.query("BEGIN");
            await validarCita(cliente, req.body);
            const estado = req.body.estado === "Confirmada" ? "Confirmada" : "Pendiente";
            const r = await cliente.query(
                `INSERT INTO citas (id_paciente, id_dermatologo, id_servicio, fecha, hora, motivo, estado, creado_por)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_cita`,
                [req.body.id_paciente, req.body.id_dermatologo, req.body.id_servicio, req.body.fecha,
                 req.body.hora, req.body.motivo || null, estado, req.usuario.id_usuario]
            );
            await cliente.query("COMMIT");
            res.status(201).json({ mensaje: "Cita agendada correctamente.", datos: r.rows[0] });
        } catch (error) {
            await cliente.query("ROLLBACK");
            manejarError(res, error);
        } finally {
            cliente.release();
        }
    },

    // PUT /api/citas/:id  (reprogramar / modificar)
    async actualizar(req, res) {
        const cliente = await pool.connect();
        try {
            requerir(req.body, ["id_paciente", "id_dermatologo", "id_servicio", "fecha", "hora"]);
            await cliente.query("BEGIN");
            const actual = await cliente.query("SELECT estado FROM citas WHERE id_cita = $1 FOR UPDATE", [req.params.id]);
            if (!actual.rows[0]) throw errorHttp(404, "Cita no encontrada.");
            if (["Atendida", "Cancelada"].includes(actual.rows[0].estado)) {
                throw errorHttp(400, `No se puede modificar una cita ${actual.rows[0].estado.toLowerCase()}.`);
            }
            await validarCita(cliente, req.body, Number(req.params.id));
            const estado = ["Pendiente", "Confirmada"].includes(req.body.estado) ? req.body.estado : actual.rows[0].estado;
            await cliente.query(
                `UPDATE citas SET id_paciente=$1, id_dermatologo=$2, id_servicio=$3, fecha=$4, hora=$5, motivo=$6, estado=$7
                  WHERE id_cita=$8`,
                [req.body.id_paciente, req.body.id_dermatologo, req.body.id_servicio, req.body.fecha,
                 req.body.hora, req.body.motivo || null, estado, req.params.id]
            );
            await cliente.query("COMMIT");
            res.json({ mensaje: "Cita actualizada correctamente." });
        } catch (error) {
            await cliente.query("ROLLBACK");
            manejarError(res, error);
        } finally {
            cliente.release();
        }
    },

    // PATCH /api/citas/:id/estado  { estado: 'Confirmada' | 'Cancelada' | 'Pendiente' }
    async cambiarEstado(req, res) {
        try {
            const nuevo = req.body.estado;
            const transiciones = {
                Pendiente: ["Confirmada", "Cancelada"],
                Confirmada: ["Pendiente", "Cancelada"],
                Atendida: [],
                Cancelada: []
            };
            const r = await pool.query("SELECT estado FROM citas WHERE id_cita = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Cita no encontrada.");
            const actual = r.rows[0].estado;
            if (nuevo === "Atendida") throw errorHttp(400, "Para marcar como atendida registre la consulta en el módulo Atención.");
            if (!transiciones[actual].includes(nuevo)) {
                throw errorHttp(400, `No se puede cambiar una cita de "${actual}" a "${nuevo}".`);
            }
            await pool.query("UPDATE citas SET estado = $1 WHERE id_cita = $2", [nuevo, req.params.id]);
            res.json({ mensaje: `Cita marcada como ${nuevo.toLowerCase()}.` });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // DELETE /api/citas/:id
    async eliminar(req, res) {
        try {
            const r = await pool.query("SELECT estado FROM citas WHERE id_cita = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Cita no encontrada.");
            if (r.rows[0].estado === "Atendida") {
                throw errorHttp(409, "No se puede eliminar una cita atendida: tiene consulta y factura asociadas.");
            }
            await pool.query("DELETE FROM citas WHERE id_cita = $1", [req.params.id]);
            res.json({ mensaje: "Cita eliminada correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default CitasController;
