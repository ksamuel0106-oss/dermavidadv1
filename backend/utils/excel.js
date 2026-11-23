/*
 * Genera reportes Excel (.xlsx) con ExcelJS y estilo de la clínica.
 */
import ExcelJS from "exceljs";
import { CLINICA } from "./pdf.js";

export async function enviarExcel(res, { archivo, hoja, titulo, subtitulo, columnas, filas, totales }) {
    const libro = new ExcelJS.Workbook();
    libro.creator = CLINICA.nombre;
    libro.created = new Date();
    const ws = libro.addWorksheet(hoja || "Reporte", { views: [{ state: "frozen", ySplit: 4 }] });

    const n = columnas.length;
    const ultima = ws.getColumn(n).letter;

    ws.mergeCells(`A1:${ultima}1`);
    ws.getCell("A1").value = CLINICA.nombre;
    ws.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D7D64" } };
    ws.getCell("A1").alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 28;

    ws.mergeCells(`A2:${ultima}2`);
    ws.getCell("A2").value = titulo + (subtitulo ? "  —  " + subtitulo : "");
    ws.getCell("A2").font = { bold: true, size: 11, color: { argb: "FF1E2D27" } };
    ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFEA" } };
    ws.getCell("A2").alignment = { indent: 1 };
    ws.getRow(2).height = 20;

    const encabezado = ws.getRow(4);
    columnas.forEach((c, i) => {
        const col = ws.getColumn(i + 1);
        col.width = c.anchoExcel || 16;
        if (c.numFmt) col.numFmt = c.numFmt;
        const celda = encabezado.getCell(i + 1);
        celda.value = c.titulo;
        celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF23634F" } };
        celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        celda.border = { bottom: { style: "thin", color: { argb: "FFC3D9CC" } } };
    });
    encabezado.height = 22;

    filas.forEach((f, idx) => {
        const fila = ws.addRow(columnas.map((c) => (c.excel ? c.excel(f[c.clave], f) : f[c.clave])));
        fila.eachCell((celda) => {
            celda.border = { bottom: { style: "hair", color: { argb: "FFC3D9CC" } } };
            if (idx % 2 === 0) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7F4" } };
        });
    });

    if (filas.length) {
        ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filas.length, column: n } };
    }

    if (totales) {
        const fila = ws.addRow(columnas.map((c, i) => (i === 0 ? "TOTALES" : totales[c.clave] ?? null)));
        fila.font = { bold: true };
        fila.eachCell((celda) => {
            celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EFEA" } };
            celda.border = { top: { style: "thin", color: { argb: "FF2D7D64" } } };
        });
    }

    ws.addRow([]);
    ws.addRow([`Generado: ${new Date().toLocaleString("es-DO")}`]).font = { italic: true, size: 9, color: { argb: "FF4E665A" } };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${archivo}.xlsx"`);
    await libro.xlsx.write(res);
    res.end();
}
