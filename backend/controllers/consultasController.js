/*
 * =====================================================================
 *  PROCESO 2: ATENCIÓN DERMATOLÓGICA Y FACTURACIÓN
 * =====================================================================
 *  En UNA sola transacción:
 *   1. Verifica que la cita exista, esté Pendiente/Confirmada y no sea futura.
 *   2. Registra la consulta (diagnóstico, tratamiento, receta).
 *   3. Cambia la cita a "Atendida".
 *   4. Genera la factura: subtotal (precio del servicio) - cobertura del
 *      seguro - descuento = total, con número consecutivo F-000001.
 *  Si algo falla se hace ROLLBACK y no queda nada a medias.
 * =====================================================================
 */
import pool from "../config/db.js";
import { manejarError, requerir, errorHttp, hoyISO } from "../utils/errores.js";
import { crearPDF, encabezado, finalizarPDF, fechaLarga, COLORES as C } from "../utils/pdf.js";

const SELECT_CONSULTAS = `
    SELECT co.*, c.fecha, TO_CHAR(c.hora,'HH24:MI') AS hora, c.motivo, c.id_paciente, c.id_dermatologo,
           p.nombre || ' ' || p.apellido AS paciente, p.cedula, p.sexo, p.alergias, p.tipo_piel,
           DATE_PART('year', AGE(p.fecha_nacimiento))::int AS edad,
           d.nombre || ' ' || d.apellido AS dermatologo, d.especialidad, d.exequatur,
           s.nombre AS servicio,
           f.id_factura, f.numero AS factura, f.total, f.estado AS estado_factura
      FROM consultas co
      JOIN citas c        ON c.id_cita = co.id_cita
      JOIN pacientes p    ON p.id_paciente = c.id_paciente
      JOIN dermatologos d ON d.id_dermatologo = c.id_dermatologo
      JOIN servicios s    ON s.id_servicio = c.id_servicio
      LEFT JOIN facturas f ON f.id_cita = c.id_cita`;

const ConsultasController = {

    // GET /api/consultas/pendientes  -> citas listas para atender (hoy o atrasadas)
    async pendientes(req, res) {
        try {
            const soloMias = req.usuario.rol === "Dermatólogo" && req.usuario.id_dermatologo;
            const r = await pool.query(
                `SELECT c.id_cita, c.fecha, TO_CHAR(c.hora,'HH24:MI') AS hora, c.estado, c.motivo,
                        p.id_paciente, p.nombre || ' ' || p.apellido AS paciente, p.cedula, p.seguro_medico,
                        p.alergias, p.tipo_piel, DATE_PART('year', AGE(p.fecha_nacimiento))::int AS edad,
                        d.nombre || ' ' || d.apellido AS dermatologo,
                        s.nombre AS servicio, s.precio, s.categoria
                   FROM citas c
                   JOIN pacientes p    ON p.id_paciente = c.id_paciente
                   JOIN dermatologos d ON d.id_dermatologo = c.id_dermatologo
                   JOIN servicios s    ON s.id_servicio = c.id_servicio
                  WHERE c.estado IN ('Pendiente','Confirmada')
                    AND c.fecha <= $1::date
                    AND ($2::int IS NULL OR c.id_dermatologo = $2::int)
                  ORDER BY c.fecha, c.hora`,
                [hoyISO(), soloMias ? req.usuario.id_dermatologo : null]
            );
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    // GET /api/consultas?desde=&hasta=&buscar=
    async listar(req, res) {
        try {
            const { desde = "", hasta = "", buscar = "" } = req.query;
            const r = await pool.query(
                `${SELECT_CONSULTAS}
                  WHERE ($1 = '' OR c.fecha >= $1::date)
                    AND ($2 = '' OR c.fecha <= $2::date)
                    AND ($3 = '' OR (p.nombre || ' ' || p.apellido) ILIKE '%' || $3 || '%'
                                 OR co.diagnostico ILIKE '%' || $3 || '%' OR p.cedula ILIKE '%' || $3 || '%')
                  ORDER BY c.fecha DESC, c.hora DESC LIMIT 500`,
                [desde, hasta, buscar.trim()]
            );
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async buscar(req, res) {
        try {
            const r = await pool.query(SELECT_CONSULTAS + " WHERE co.id_consulta = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Consulta no encontrada.");
            res.json(r.rows[0]);
        } catch (error) {
            manejarError(res, error);
        }
    },

    // POST /api/consultas  -> PROCESO DE ATENCIÓN + FACTURACIÓN
    async atender(req, res) {
        const cliente = await pool.connect();
        try {
            requerir(req.body, ["id_cita", "diagnostico", "tratamiento", "metodo_pago"]);
            await cliente.query("BEGIN");

            // 1. Cita válida (bloqueada para evitar doble atención)
            const rc = await cliente.query(
                `SELECT c.*, s.precio, s.nombre AS servicio, p.seguro_medico
                   FROM citas c
                   JOIN servicios s ON s.id_servicio = c.id_servicio
                   JOIN pacientes p ON p.id_paciente = c.id_paciente
                  WHERE c.id_cita = $1 FOR UPDATE OF c`,
                [req.body.id_cita]
            );
            const cita = rc.rows[0];
            if (!cita) throw errorHttp(404, "La cita no existe.");
            if (!["Pendiente", "Confirmada"].includes(cita.estado)) {
                throw errorHttp(400, `La cita está "${cita.estado}" y no puede atenderse.`);
            }
            if (cita.fecha > hoyISO()) throw errorHttp(400, "No se puede atender una cita programada para una fecha futura.");
            if (req.usuario.rol === "Dermatólogo" && req.usuario.id_dermatologo && req.usuario.id_dermatologo !== cita.id_dermatologo) {
                throw errorHttp(403, "Solo puede atender sus propias citas.");
            }

            // 2. Cálculo de la factura
            const subtotal = Number(cita.precio);
            let cobertura = Math.max(0, Number(req.body.cobertura_seguro || 0));
            let descuento = Math.max(0, Number(req.body.descuento || 0));
            if (cobertura > 0 && cita.seguro_medico === "Ninguno") {
                throw errorHttp(400, "El paciente no tiene seguro médico registrado; la cobertura debe ser 0.");
            }
            if (cobertura > subtotal) throw errorHttp(400, "La cobertura del seguro no puede ser mayor que el subtotal.");
            if (descuento > subtotal - cobertura) throw errorHttp(400, "El descuento excede el monto a pagar.");
            const total = Math.round((subtotal - cobertura - descuento) * 100) / 100;
            if (req.body.metodo_pago === "Seguro" && cobertura === 0) {
                throw errorHttp(400, "Si el método es Seguro, indique el monto de cobertura.");
            }

            // 3. Registrar consulta
            const rco = await cliente.query(
                `INSERT INTO consultas (id_cita, diagnostico, tratamiento, receta, observaciones, proximo_control)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_consulta`,
                [cita.id_cita, req.body.diagnostico.trim(), req.body.tratamiento.trim(),
                 req.body.receta || null, req.body.observaciones || null, req.body.proximo_control || null]
            );

            // 4. Actualizar estado de la cita
            await cliente.query("UPDATE citas SET estado = 'Atendida' WHERE id_cita = $1", [cita.id_cita]);

            // 5. Generar factura con número consecutivo
            await cliente.query("LOCK TABLE facturas IN SHARE ROW EXCLUSIVE MODE");
            const rn = await cliente.query("SELECT COALESCE(MAX(SUBSTRING(numero FROM 3)::int), 0) + 1 AS n FROM facturas");
            const numero = "F-" + String(rn.rows[0].n).padStart(6, "0");
            const rf = await cliente.query(
                `INSERT INTO facturas (numero, id_cita, subtotal, cobertura_seguro, descuento, total, metodo_pago)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id_factura`,
                [numero, cita.id_cita, subtotal, cobertura, descuento, total, req.body.metodo_pago]
            );

            await cliente.query("COMMIT");
            res.status(201).json({
                mensaje: `Consulta registrada y factura ${numero} generada por RD$ ${total.toFixed(2)}.`,
                datos: { id_consulta: rco.rows[0].id_consulta, id_factura: rf.rows[0].id_factura, numero, total }
            });
        } catch (error) {
            await cliente.query("ROLLBACK");
            manejarError(res, error);
        } finally {
            cliente.release();
        }
    },

    // PUT /api/consultas/:id  (solo datos clínicos)
    async actualizar(req, res) {
        try {
            requerir(req.body, ["diagnostico", "tratamiento"]);
            const r = await pool.query(
                `UPDATE consultas SET diagnostico=$1, tratamiento=$2, receta=$3, observaciones=$4, proximo_control=$5
                  WHERE id_consulta=$6 RETURNING id_consulta`,
                [req.body.diagnostico, req.body.tratamiento, req.body.receta || null,
                 req.body.observaciones || null, req.body.proximo_control || null, req.params.id]
            );
            if (!r.rows[0]) throw errorHttp(404, "Consulta no encontrada.");
            res.json({ mensaje: "Consulta actualizada correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // DELETE /api/consultas/:id  -> revierte la atención (Administrador)
    async eliminar(req, res) {
        const cliente = await pool.connect();
        try {
            await cliente.query("BEGIN");
            const r = await cliente.query("SELECT id_cita FROM consultas WHERE id_consulta = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Consulta no encontrada.");
            const idCita = r.rows[0].id_cita;
            await cliente.query("DELETE FROM facturas WHERE id_cita = $1", [idCita]);
            await cliente.query("DELETE FROM consultas WHERE id_consulta = $1", [req.params.id]);
            await cliente.query("UPDATE citas SET estado = 'Confirmada' WHERE id_cita = $1", [idCita]);
            await cliente.query("COMMIT");
            res.json({ mensaje: "Atención revertida: se eliminó la consulta y su factura; la cita volvió a Confirmada." });
        } catch (error) {
            await cliente.query("ROLLBACK");
            manejarError(res, error);
        } finally {
            cliente.release();
        }
    },

    // GET /api/consultas/:id/receta  -> PDF de receta / indicación médica
    async recetaPDF(req, res) {
        try {
            const r = await pool.query(SELECT_CONSULTAS + " WHERE co.id_consulta = $1", [req.params.id]);
            const co = r.rows[0];
            if (!co) throw errorHttp(404, "Consulta no encontrada.");

            const doc = crearPDF(res, `Receta_${co.cedula}_${co.fecha}`);
            encabezado(doc, "Indicación Médica / Receta", `Consulta #${co.id_consulta} • ${fechaLarga(co.fecha)} • ${co.hora}`);

            const izq = 40, ancho = doc.page.width - 80;
            let y = doc.y;
            doc.rect(izq, y, ancho, 62).fill(C.superficie);
            doc.fillColor(C.suave).font("Helvetica-Bold").fontSize(8);
            doc.text("PACIENTE", izq + 12, y + 10).text("CÉDULA", izq + 260, y + 10).text("EDAD / SEXO", izq + 400, y + 10);
            doc.fillColor(C.texto).font("Helvetica-Bold").fontSize(11);
            doc.text(co.paciente, izq + 12, y + 22).text(co.cedula, izq + 260, y + 22).text(`${co.edad} años / ${co.sexo === "F" ? "Femenino" : "Masculino"}`, izq + 400, y + 22);
            doc.fillColor(C.suave).font("Helvetica").fontSize(9)
                .text(`Fototipo: ${co.tipo_piel}   •   Alergias: ${co.alergias || "Ninguna conocida"}   •   Servicio: ${co.servicio}`, izq + 12, y + 42);
            doc.y = y + 80;

            const bloque = (titulo, texto) => {
                if (!texto) return;
                doc.x = izq;
                doc.fillColor(C.primario).font("Helvetica-Bold").fontSize(11).text(titulo);
                doc.moveTo(izq, doc.y + 2).lineTo(izq + ancho, doc.y + 2).lineWidth(0.6).stroke(C.borde);
                doc.moveDown(0.4).fillColor(C.texto).font("Helvetica").fontSize(10.5).text(texto, { width: ancho, lineGap: 2 });
                doc.moveDown(0.9);
            };
            bloque("Diagnóstico", co.diagnostico);
            doc.x = izq;
            doc.fillColor(C.primario).font("Helvetica-Bold").fontSize(26).text("Rx", izq, doc.y);
            doc.moveDown(0.2);
            bloque("Medicamentos e indicaciones", co.receta || "Sin medicamentos indicados.");
            bloque("Tratamiento", co.tratamiento);
            bloque("Observaciones", co.observaciones);
            if (co.proximo_control) bloque("Próximo control", fechaLarga(co.proximo_control));

            const yf = Math.max(doc.y + 40, doc.page.height - 170);
            doc.moveTo(doc.page.width - 260, yf).lineTo(doc.page.width - 40, yf).lineWidth(0.8).stroke(C.texto);
            doc.fillColor(C.texto).font("Helvetica-Bold").fontSize(10).text(co.dermatologo, doc.page.width - 260, yf + 6, { width: 220, align: "center" });
            doc.font("Helvetica").fontSize(9).fillColor(C.suave)
                .text(`${co.especialidad} • Exequátur ${co.exequatur}`, doc.page.width - 260, yf + 20, { width: 220, align: "center" });

            finalizarPDF(doc, req.usuario.nombre);
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default ConsultasController;
