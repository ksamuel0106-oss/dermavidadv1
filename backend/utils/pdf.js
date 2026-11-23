/*
 * Utilidades para generar documentos PDF con PDFKit
 * usando la identidad visual de la clínica (paleta verde pastel).
 */
import PDFDocument from "pdfkit";

export const CLINICA = {
    nombre: "Clínica Dermatológica DermaVida",
    lema: "Cuidamos la salud de tu piel",
    direccion: "Av. Pedro A. Rivera #32, La Vega, República Dominicana",
    telefono: "809-573-2200",
    correo: "info@dermavida.do"
};

const C = {
    primario: "#2D7D64",
    primarioOscuro: "#23634F",
    superficie: "#E6EFEA",
    borde: "#C3D9CC",
    fondo: "#F4F7F4",
    texto: "#1E2D27",
    suave: "#4E665A",
    peligro: "#C62828"
};

export const dinero = (n) => "RD$ " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fechaLarga(f) {
    if (!f) return "";
    const [a, m, d] = String(f).slice(0, 10).split("-");
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${Number(d)} de ${meses[Number(m) - 1]} de ${a}`;
}

export function fechaCorta(f) {
    if (!f) return "";
    const [a, m, d] = String(f).slice(0, 10).split("-");
    return `${d}/${m}/${a}`;
}

/* Crea el documento y lo conecta a la respuesta HTTP */
export function crearPDF(res, nombreArchivo, horizontal = false) {
    const doc = new PDFDocument({
        size: "LETTER",
        layout: horizontal ? "landscape" : "portrait",
        margins: { top: 40, bottom: 50, left: 40, right: 40 },
        bufferPages: true,
        info: { Title: nombreArchivo, Author: CLINICA.nombre }
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreArchivo}.pdf"`);
    doc.pipe(res);
    return doc;
}

/* Logo vectorial: círculo verde con cruz blanca y gota */
function logo(doc, x, y, r) {
    doc.save();
    doc.circle(x + r, y + r, r).fill("#FFFFFF");
    doc.circle(x + r, y + r, r - 3).fill(C.primario);
    doc.circle(x + r, y + r, r - 5).lineWidth(1).stroke("#FFFFFF");
    const s = r * 0.32;
    doc.roundedRect(x + r - s / 2, y + r - s * 1.5, s, s * 3, 2).fill("#FFFFFF");
    doc.roundedRect(x + r - s * 1.5, y + r - s / 2, s * 3, s, 2).fill("#FFFFFF");
    doc.circle(x + r, y + r, s * 0.42).fill(C.primario);
    doc.restore();
}

/* Encabezado corporativo + título del documento */
export function encabezado(doc, titulo, subtitulo = "") {
    const ancho = doc.page.width;
    doc.save();
    doc.rect(0, 0, ancho, 78).fill(C.primario);
    doc.rect(0, 78, ancho, 4).fill(C.borde);
    logo(doc, 40, 14, 25);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(17).text(CLINICA.nombre, 100, 20, { lineBreak: false });
    doc.font("Helvetica").fontSize(9).fillColor("#E6EFEA")
        .text(`${CLINICA.direccion}  •  Tel. ${CLINICA.telefono}  •  ${CLINICA.correo}`, 100, 44, { lineBreak: false });
    doc.restore();

    doc.y = 100;
    doc.x = doc.page.margins.left;
    doc.fillColor(C.primario).font("Helvetica-Bold").fontSize(16).text(titulo, { align: "left" });
    if (subtitulo) {
        doc.moveDown(0.2).fillColor(C.suave).font("Helvetica").fontSize(9.5).text(subtitulo);
    }
    doc.moveDown(0.8);
    doc.fillColor(C.texto);
}

/*
 * Tabla con encabezado repetido en cada página.
 * columnas: [{ titulo, clave, ancho (proporción), alinear, formato(fn) }]
 */
export function tabla(doc, columnas, filas) {
    const izq = doc.page.margins.left;
    const anchoUtil = doc.page.width - izq - doc.page.margins.right;
    const total = columnas.reduce((s, c) => s + (c.ancho || 1), 0);
    const anchos = columnas.map((c) => ((c.ancho || 1) / total) * anchoUtil);
    const pad = 4;

    const dibujarEncabezado = () => {
        const y = doc.y;
        doc.rect(izq, y, anchoUtil, 20).fill(C.primario);
        let x = izq;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF");
        columnas.forEach((c, i) => {
            doc.text(c.titulo.toUpperCase(), x + pad, y + 6, { width: anchos[i] - pad * 2, align: c.alinear || "left", lineBreak: false, ellipsis: true });
            x += anchos[i];
        });
        doc.y = y + 20;
    };

    dibujarEncabezado();
    doc.font("Helvetica").fontSize(8.5);

    if (!filas.length) {
        doc.fillColor(C.suave).text("No hay registros para los filtros seleccionados.", izq + pad, doc.y + 8);
        doc.moveDown();
        return;
    }

    filas.forEach((fila, n) => {
        const textos = columnas.map((c) => {
            const v = fila[c.clave];
            return c.formato ? c.formato(v, fila) : (v === null || v === undefined ? "" : String(v));
        });
        const alto = Math.max(16, ...textos.map((t, i) => doc.heightOfString(t, { width: anchos[i] - pad * 2 }) + 8));

        if (doc.y + alto > doc.page.height - doc.page.margins.bottom - 10) {
            doc.addPage();
            doc.y = doc.page.margins.top;
            dibujarEncabezado();
            doc.font("Helvetica").fontSize(8.5);
        }
        const y = doc.y;
        if (n % 2 === 0) doc.rect(izq, y, anchoUtil, alto).fill(C.fondo);
        doc.moveTo(izq, y + alto).lineTo(izq + anchoUtil, y + alto).lineWidth(0.5).stroke(C.borde);
        let x = izq;
        doc.fillColor(C.texto);
        textos.forEach((t, i) => {
            doc.text(t, x + pad, y + 4, { width: anchos[i] - pad * 2, align: columnas[i].alinear || "left" });
            x += anchos[i];
        });
        doc.y = y + alto;
    });
    doc.x = izq;
}

/* Caja de resumen (pares etiqueta/valor) */
export function resumen(doc, pares) {
    const izq = doc.page.margins.left;
    const ancho = doc.page.width - izq - doc.page.margins.right;
    doc.moveDown(0.8);
    if (doc.y + 30 > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    const w = ancho / pares.length;
    doc.rect(izq, y, ancho, 38).fill(C.superficie);
    doc.rect(izq, y, ancho, 38).lineWidth(0.8).stroke(C.borde);
    pares.forEach(([etq, val], i) => {
        doc.fillColor(C.suave).font("Helvetica-Bold").fontSize(7.5).text(etq.toUpperCase(), izq + i * w + 10, y + 7, { width: w - 20 });
        doc.fillColor(C.primarioOscuro).font("Helvetica-Bold").fontSize(12).text(String(val), izq + i * w + 10, y + 19, { width: w - 20 });
    });
    doc.y = y + 48;
    doc.x = izq;
}

/* Pie de página con numeración en todas las páginas */
export function finalizarPDF(doc, usuario = "") {
    const rango = doc.bufferedPageRange();
    const ahora = new Date().toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });
    for (let i = 0; i < rango.count; i++) {
        doc.switchToPage(rango.start + i);
        const y = doc.page.height - 32;
        const margenInf = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(40, y - 6).lineTo(doc.page.width - 40, y - 6).lineWidth(0.5).stroke(C.borde);
        doc.font("Helvetica").fontSize(7.5).fillColor(C.suave);
        doc.text(`Generado el ${ahora}${usuario ? " por " + usuario : ""} • ${CLINICA.nombre}`, 40, y, { lineBreak: false });
        doc.text(`Página ${i + 1} de ${rango.count}`, doc.page.width - 140, y, { width: 100, align: "right", lineBreak: false });
        doc.page.margins.bottom = margenInf;
    }
    doc.end();
}

export const COLORES = C;
