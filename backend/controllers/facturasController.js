import pool from "../config/db.js";
import { manejarError, errorHttp } from "../utils/errores.js";
import { crearPDF, encabezado, finalizarPDF, dinero, fechaLarga, COLORES as C } from "../utils/pdf.js";

const SELECT_FACTURAS = `
    SELECT f.*, TO_CHAR(f.fecha, 'YYYY-MM-DD HH24:MI') AS fecha_texto,
           c.fecha AS fecha_cita, TO_CHAR(c.hora,'HH24:MI') AS hora,
           p.nombre || ' ' || p.apellido AS paciente, p.cedula, p.telefono, p.seguro_medico, p.direccion,
           d.nombre || ' ' || d.apellido AS dermatologo,
           s.nombre AS servicio, s.categoria
      FROM facturas f
      JOIN citas c        ON c.id_cita = f.id_cita
      JOIN pacientes p    ON p.id_paciente = c.id_paciente
      JOIN dermatologos d ON d.id_dermatologo = c.id_dermatologo
      JOIN servicios s    ON s.id_servicio = c.id_servicio`;

const FacturasController = {

    async listar(req, res) {
        try {
            const { desde = "", hasta = "", estado = "", metodo = "", buscar = "" } = req.query;
            const r = await pool.query(
                `${SELECT_FACTURAS}
                  WHERE ($1 = '' OR f.fecha::date >= $1::date)
                    AND ($2 = '' OR f.fecha::date <= $2::date)
                    AND ($3 = '' OR f.estado = $3)
                    AND ($4 = '' OR f.metodo_pago = $4)
                    AND ($5 = '' OR f.numero ILIKE '%' || $5 || '%' OR (p.nombre || ' ' || p.apellido) ILIKE '%' || $5 || '%')
                  ORDER BY f.fecha DESC LIMIT 500`,
                [desde, hasta, estado, metodo, buscar.trim()]
            );
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async buscar(req, res) {
        try {
            const r = await pool.query(SELECT_FACTURAS + " WHERE f.id_factura = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Factura no encontrada.");
            res.json(r.rows[0]);
        } catch (error) {
            manejarError(res, error);
        }
    },

    // PATCH /api/facturas/:id/anular
    async anular(req, res) {
        try {
            const r = await pool.query(
                "UPDATE facturas SET estado = 'Anulada' WHERE id_factura = $1 AND estado = 'Pagada' RETURNING numero",
                [req.params.id]
            );
            if (!r.rows[0]) throw errorHttp(400, "La factura no existe o ya está anulada.");
            res.json({ mensaje: `Factura ${r.rows[0].numero} anulada.` });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // GET /api/facturas/:id/pdf
    async pdf(req, res) {
        try {
            const r = await pool.query(SELECT_FACTURAS + " WHERE f.id_factura = $1", [req.params.id]);
            const f = r.rows[0];
            if (!f) throw errorHttp(404, "Factura no encontrada.");

            const doc = crearPDF(res, `Factura_${f.numero}`);
            encabezado(doc, `Factura ${f.numero}`, `Emitida el ${fechaLarga(f.fecha_texto)} a las ${f.fecha_texto.slice(11)}`);

            const izq = 40, ancho = doc.page.width - 80;
            let y = doc.y;
            doc.rect(izq, y, ancho / 2 - 6, 86).fill(C.superficie);
            doc.rect(izq + ancho / 2 + 6, y, ancho / 2 - 6, 86).fill(C.superficie);
            doc.fillColor(C.suave).font("Helvetica-Bold").fontSize(8).text("FACTURADO A", izq + 12, y + 10);
            doc.fillColor(C.texto).font("Helvetica-Bold").fontSize(11).text(f.paciente, izq + 12, y + 24);
            doc.font("Helvetica").fontSize(9).fillColor(C.suave)
                .text(`Cédula: ${f.cedula}`, izq + 12, y + 40)
                .text(`Teléfono: ${f.telefono}`, izq + 12, y + 53)
                .text(`Seguro: ${f.seguro_medico}`, izq + 12, y + 66);
            const x2 = izq + ancho / 2 + 18;
            doc.fillColor(C.suave).font("Helvetica-Bold").fontSize(8).text("DETALLE DE LA ATENCIÓN", x2, y + 10);
            doc.fillColor(C.texto).font("Helvetica-Bold").fontSize(11).text(f.dermatologo, x2, y + 24);
            doc.font("Helvetica").fontSize(9).fillColor(C.suave)
                .text(`Cita: ${fechaLarga(f.fecha_cita)} • ${f.hora}`, x2, y + 40)
                .text(`Método de pago: ${f.metodo_pago}`, x2, y + 53)
                .text(`Estado: ${f.estado}`, x2, y + 66);
            y += 104;

            // Detalle
            doc.rect(izq, y, ancho, 22).fill(C.primario);
            doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9)
                .text("DESCRIPCIÓN", izq + 10, y + 7).text("CATEGORÍA", izq + 300, y + 7)
                .text("IMPORTE", izq + ancho - 110, y + 7, { width: 100, align: "right" });
            y += 22;
            doc.rect(izq, y, ancho, 28).fill(C.fondo);
            doc.fillColor(C.texto).font("Helvetica").fontSize(10)
                .text(f.servicio, izq + 10, y + 9).text(f.categoria, izq + 300, y + 9)
                .text(dinero(f.subtotal), izq + ancho - 110, y + 9, { width: 100, align: "right" });
            y += 44;

            const fila = (etq, val, negrita = false, color = C.texto) => {
                doc.fillColor(color).font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(negrita ? 13 : 10)
                    .text(etq, izq + ancho - 300, y, { width: 170, align: "right" })
                    .text(val, izq + ancho - 120, y, { width: 110, align: "right" });
                y += negrita ? 22 : 16;
            };
            fila("Subtotal:", dinero(f.subtotal));
            fila("Cobertura del seguro:", "- " + dinero(f.cobertura_seguro), false, C.suave);
            fila("Descuento:", "- " + dinero(f.descuento), false, C.suave);
            doc.moveTo(izq + ancho - 300, y).lineTo(izq + ancho - 10, y).lineWidth(1).stroke(C.primario);
            y += 6;
            fila("TOTAL A PAGAR:", dinero(f.total), true, C.primarioOscuro);

            doc.fillColor(C.suave).font("Helvetica-Oblique").fontSize(8.5)
                .text("Servicios de salud exentos de ITBIS. Gracias por confiar en DermaVida.", izq, y + 30, { width: ancho, align: "center" });

            if (f.estado === "Anulada") {
                doc.save().rotate(-30, { origin: [300, 400] }).fillColor(C.peligro).opacity(0.18)
                    .font("Helvetica-Bold").fontSize(90).text("ANULADA", 90, 360).restore();
            }
            finalizarPDF(doc, req.usuario.nombre);
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default FacturasController;
