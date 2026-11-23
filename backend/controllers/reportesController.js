/*
 * Reportes del sistema en tres formatos:
 *   ?formato=json  -> vista previa en pantalla
 *   ?formato=pdf   -> descarga PDF (PDFKit)
 *   ?formato=xlsx  -> descarga Excel (ExcelJS)
 */
import pool from "../config/db.js";
import { manejarError, errorHttp } from "../utils/errores.js";
import { crearPDF, encabezado, tabla, resumen, finalizarPDF, dinero, fechaCorta } from "../utils/pdf.js";
import { enviarExcel } from "../utils/excel.js";

const MONEDA = '"RD$" #,##0.00';
const fmtDinero = (v) => dinero(v);

const REPORTES = {

    pacientes: {
        titulo: "Listado de pacientes registrados",
        horizontal: true,
        columnas: [
            { titulo: "Cédula", clave: "cedula", ancho: 1.3, anchoExcel: 16 },
            { titulo: "Paciente", clave: "paciente", ancho: 2.2, anchoExcel: 30 },
            { titulo: "Edad", clave: "edad", ancho: 0.6, alinear: "center", anchoExcel: 8 },
            { titulo: "Sexo", clave: "sexo", ancho: 0.6, alinear: "center", anchoExcel: 8 },
            { titulo: "Teléfono", clave: "telefono", ancho: 1.2, anchoExcel: 15 },
            { titulo: "Seguro", clave: "seguro_medico", ancho: 1.4, anchoExcel: 18 },
            { titulo: "Fototipo", clave: "tipo_piel", ancho: 0.8, alinear: "center", anchoExcel: 10 },
            { titulo: "Alergias", clave: "alergias", ancho: 1.2, anchoExcel: 16 },
            { titulo: "Citas", clave: "total_citas", ancho: 0.6, alinear: "center", anchoExcel: 8 }
        ],
        async datos() {
            const r = await pool.query(`
                SELECT p.cedula, p.nombre || ' ' || p.apellido AS paciente,
                       DATE_PART('year', AGE(p.fecha_nacimiento))::int AS edad, p.sexo, p.telefono,
                       p.seguro_medico, p.tipo_piel, COALESCE(p.alergias,'—') AS alergias,
                       (SELECT COUNT(*) FROM citas c WHERE c.id_paciente = p.id_paciente) AS total_citas
                  FROM pacientes p ORDER BY p.apellido, p.nombre`);
            return {
                filas: r.rows,
                resumen: [["Total de pacientes", r.rows.length],
                          ["Con seguro", r.rows.filter((f) => f.seguro_medico !== "Ninguno").length],
                          ["Femenino / Masculino", `${r.rows.filter((f) => f.sexo === "F").length} / ${r.rows.filter((f) => f.sexo === "M").length}`]]
            };
        }
    },

    citas: {
        titulo: "Reporte de citas",
        usaFechas: true,
        horizontal: true,
        columnas: [
            { titulo: "Fecha", clave: "fecha", ancho: 0.9, formato: fechaCorta, anchoExcel: 12 },
            { titulo: "Hora", clave: "hora", ancho: 0.6, anchoExcel: 8 },
            { titulo: "Paciente", clave: "paciente", ancho: 1.9, anchoExcel: 28 },
            { titulo: "Dermatólogo", clave: "dermatologo", ancho: 1.8, anchoExcel: 26 },
            { titulo: "Servicio", clave: "servicio", ancho: 2, anchoExcel: 30 },
            { titulo: "Estado", clave: "estado", ancho: 0.9, anchoExcel: 12 }
        ],
        async datos({ desde, hasta, estado }) {
            const r = await pool.query(`
                SELECT c.fecha, TO_CHAR(c.hora,'HH24:MI') AS hora, p.nombre || ' ' || p.apellido AS paciente,
                       d.nombre || ' ' || d.apellido AS dermatologo, s.nombre AS servicio, c.estado
                  FROM citas c
                  JOIN pacientes p ON p.id_paciente = c.id_paciente
                  JOIN dermatologos d ON d.id_dermatologo = c.id_dermatologo
                  JOIN servicios s ON s.id_servicio = c.id_servicio
                 WHERE c.fecha BETWEEN $1 AND $2 AND ($3 = '' OR c.estado = $3)
                 ORDER BY c.fecha, c.hora`, [desde, hasta, estado || ""]);
            const cuenta = (e) => r.rows.filter((f) => f.estado === e).length;
            return {
                filas: r.rows,
                resumen: [["Total citas", r.rows.length], ["Atendidas", cuenta("Atendida")],
                          ["Pendientes / Confirmadas", cuenta("Pendiente") + cuenta("Confirmada")], ["Canceladas", cuenta("Cancelada")]]
            };
        }
    },

    ingresos: {
        titulo: "Reporte de ingresos (facturación)",
        usaFechas: true,
        horizontal: true,
        columnas: [
            { titulo: "Factura", clave: "numero", ancho: 0.9, anchoExcel: 11 },
            { titulo: "Fecha", clave: "fecha", ancho: 0.9, formato: fechaCorta, anchoExcel: 12 },
            { titulo: "Paciente", clave: "paciente", ancho: 1.8, anchoExcel: 26 },
            { titulo: "Servicio", clave: "servicio", ancho: 1.7, anchoExcel: 28 },
            { titulo: "Subtotal", clave: "subtotal", ancho: 1, alinear: "right", formato: fmtDinero, numFmt: MONEDA, anchoExcel: 14 },
            { titulo: "Seguro", clave: "cobertura_seguro", ancho: 1, alinear: "right", formato: fmtDinero, numFmt: MONEDA, anchoExcel: 14 },
            { titulo: "Desc.", clave: "descuento", ancho: 0.9, alinear: "right", formato: fmtDinero, numFmt: MONEDA, anchoExcel: 13 },
            { titulo: "Total", clave: "total", ancho: 1, alinear: "right", formato: fmtDinero, numFmt: MONEDA, anchoExcel: 14 },
            { titulo: "Pago", clave: "metodo_pago", ancho: 1.15, anchoExcel: 14 },
            { titulo: "Estado", clave: "estado", ancho: 0.8, anchoExcel: 10 }
        ],
        async datos({ desde, hasta }) {
            const r = await pool.query(`
                SELECT f.numero, TO_CHAR(f.fecha,'YYYY-MM-DD') AS fecha, p.nombre || ' ' || p.apellido AS paciente,
                       s.nombre AS servicio, f.subtotal, f.cobertura_seguro, f.descuento, f.total, f.metodo_pago, f.estado
                  FROM facturas f
                  JOIN citas c ON c.id_cita = f.id_cita
                  JOIN pacientes p ON p.id_paciente = c.id_paciente
                  JOIN servicios s ON s.id_servicio = c.id_servicio
                 WHERE f.fecha::date BETWEEN $1 AND $2
                 ORDER BY f.fecha, f.numero`, [desde, hasta]);
            const pagadas = r.rows.filter((f) => f.estado === "Pagada");
            const suma = (k) => Math.round(pagadas.reduce((s, f) => s + f[k], 0) * 100) / 100;
            return {
                filas: r.rows,
                totales: { subtotal: suma("subtotal"), cobertura_seguro: suma("cobertura_seguro"), descuento: suma("descuento"), total: suma("total") },
                resumen: [["Facturas pagadas", pagadas.length], ["Anuladas", r.rows.length - pagadas.length],
                          ["Cubierto por seguros", dinero(suma("cobertura_seguro"))], ["Ingreso neto", dinero(suma("total"))]]
            };
        }
    },

    servicios: {
        titulo: "Servicios más solicitados e ingresos por servicio",
        usaFechas: true,
        columnas: [
            { titulo: "Servicio", clave: "servicio", ancho: 2.4, anchoExcel: 34 },
            { titulo: "Categoría", clave: "categoria", ancho: 1, anchoExcel: 14 },
            { titulo: "Precio", clave: "precio", ancho: 1, alinear: "right", formato: fmtDinero, numFmt: MONEDA, anchoExcel: 14 },
            { titulo: "Atendidos", clave: "atendidos", ancho: 0.8, alinear: "center", anchoExcel: 11 },
            { titulo: "Ingresos", clave: "ingresos", ancho: 1.2, alinear: "right", formato: fmtDinero, numFmt: MONEDA, anchoExcel: 16 }
        ],
        async datos({ desde, hasta }) {
            const r = await pool.query(`
                SELECT s.nombre AS servicio, s.categoria, s.precio,
                       COUNT(f.id_factura) FILTER (WHERE f.estado = 'Pagada') AS atendidos,
                       COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'Pagada'), 0) AS ingresos
                  FROM servicios s
                  LEFT JOIN citas c ON c.id_servicio = s.id_servicio AND c.fecha BETWEEN $1 AND $2
                  LEFT JOIN facturas f ON f.id_cita = c.id_cita
                 GROUP BY s.id_servicio
                 ORDER BY atendidos DESC, ingresos DESC`, [desde, hasta]);
            const total = r.rows.reduce((s, f) => s + Number(f.ingresos), 0);
            return {
                filas: r.rows,
                totales: { atendidos: r.rows.reduce((s, f) => s + f.atendidos, 0), ingresos: total },
                resumen: [["Servicio líder", r.rows[0]?.atendidos ? r.rows[0].servicio : "—"],
                          ["Procedimientos", r.rows.reduce((s, f) => s + f.atendidos, 0)], ["Ingresos", dinero(total)]]
            };
        }
    },

    dermatologos: {
        titulo: "Productividad por dermatólogo",
        usaFechas: true,
        columnas: [
            { titulo: "Dermatólogo", clave: "dermatologo", ancho: 2, anchoExcel: 28 },
            { titulo: "Especialidad", clave: "especialidad", ancho: 1.8, anchoExcel: 26 },
            { titulo: "Citas", clave: "citas", ancho: 0.7, alinear: "center", anchoExcel: 9 },
            { titulo: "Atendidas", clave: "atendidas", ancho: 0.8, alinear: "center", anchoExcel: 11 },
            { titulo: "Canceladas", clave: "canceladas", ancho: 0.8, alinear: "center", anchoExcel: 11 },
            { titulo: "Ingresos", clave: "ingresos", ancho: 1.2, alinear: "right", formato: fmtDinero, numFmt: MONEDA, anchoExcel: 16 }
        ],
        async datos({ desde, hasta }) {
            const r = await pool.query(`
                SELECT d.nombre || ' ' || d.apellido AS dermatologo, d.especialidad,
                       COUNT(c.id_cita) AS citas,
                       COUNT(c.id_cita) FILTER (WHERE c.estado = 'Atendida') AS atendidas,
                       COUNT(c.id_cita) FILTER (WHERE c.estado = 'Cancelada') AS canceladas,
                       COALESCE(SUM(f.total) FILTER (WHERE f.estado = 'Pagada'), 0) AS ingresos
                  FROM dermatologos d
                  LEFT JOIN citas c ON c.id_dermatologo = d.id_dermatologo AND c.fecha BETWEEN $1 AND $2
                  LEFT JOIN facturas f ON f.id_cita = c.id_cita
                 GROUP BY d.id_dermatologo
                 ORDER BY ingresos DESC`, [desde, hasta]);
            const total = r.rows.reduce((s, f) => s + Number(f.ingresos), 0);
            return {
                filas: r.rows,
                totales: { citas: r.rows.reduce((s, f) => s + f.citas, 0), atendidas: r.rows.reduce((s, f) => s + f.atendidas, 0),
                           canceladas: r.rows.reduce((s, f) => s + f.canceladas, 0), ingresos: total },
                resumen: [["Dermatólogos", r.rows.length], ["Citas atendidas", r.rows.reduce((s, f) => s + f.atendidas, 0)], ["Ingresos", dinero(total)]]
            };
        }
    }
};

const ReportesController = {

    // GET /api/reportes  -> catálogo disponible
    catalogo(req, res) {
        res.json(Object.entries(REPORTES).map(([id, r]) => ({ id, titulo: r.titulo, usaFechas: !!r.usaFechas })));
    },

    // GET /api/reportes/:tipo?formato=json|pdf|xlsx&desde=&hasta=&estado=
    async generar(req, res) {
        try {
            const def = REPORTES[req.params.tipo];
            if (!def) throw errorHttp(404, "Reporte no encontrado.");

            const hoy = new Date();
            const z = (n) => String(n).padStart(2, "0");
            const inicioMes = `${hoy.getFullYear()}-${z(hoy.getMonth() + 1)}-01`;
            const desde = req.query.desde || inicioMes;
            const hasta = req.query.hasta || `${hoy.getFullYear()}-12-31`;
            if (def.usaFechas && desde > hasta) throw errorHttp(400, "La fecha inicial no puede ser mayor que la final.");

            const { filas, resumen: res_, totales } = await def.datos({ desde, hasta, estado: req.query.estado });
            const subtitulo = def.usaFechas
                ? `Período: ${fechaCorta(desde)} al ${fechaCorta(hasta)}${req.query.estado ? " • Estado: " + req.query.estado : ""}`
                : `Total de registros: ${filas.length}`;
            const archivo = `Reporte_${req.params.tipo}_${desde}_${hasta}`.replace(/[^\w-]/g, "");
            const formato = (req.query.formato || "json").toLowerCase();

            if (formato === "pdf") {
                const doc = crearPDF(res, archivo, def.horizontal);
                encabezado(doc, def.titulo, subtitulo);
                tabla(doc, def.columnas, filas);
                if (res_) resumen(doc, res_);
                finalizarPDF(doc, req.usuario.nombre);
            } else if (formato === "xlsx" || formato === "excel") {
                await enviarExcel(res, { archivo, hoja: req.params.tipo, titulo: def.titulo, subtitulo, columnas: def.columnas, filas, totales });
            } else {
                res.json({ titulo: def.titulo, subtitulo, columnas: def.columnas.map(({ titulo, clave, alinear, numFmt }) => ({ titulo, clave, alinear, moneda: !!numFmt })), filas, resumen: res_, totales });
            }
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default ReportesController;
