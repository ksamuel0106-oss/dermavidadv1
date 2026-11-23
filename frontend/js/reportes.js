/* Reportes — vista previa en pantalla y descarga en PDF / Excel */
const ICONOS = { pacientes: "👥", citas: "📅", ingresos: "💵", servicios: "✨", dermatologos: "👩‍⚕️" };
const DESCRIP = {
    pacientes: "Listado completo con seguro, fototipo y alergias.",
    citas: "Citas por período y estado.",
    ingresos: "Facturación, coberturas y totales.",
    servicios: "Ranking de servicios e ingresos.",
    dermatologos: "Productividad por especialista."
};
const r = { desde: document.getElementById("rDesde"), hasta: document.getElementById("rHasta"), estado: document.getElementById("rEstado") };
r.desde.value = hoyISO().slice(0, 8) + "01";
r.hasta.value = hoyISO();
let catalogo = [];
let actual = "ingresos";

function parametros(formato) {
    const p = new URLSearchParams({ formato, desde: r.desde.value, hasta: r.hasta.value });
    if (actual === "citas" && r.estado.value) p.set("estado", r.estado.value);
    return `/reportes/${actual}?${p}`;
}

function seleccionar(id) {
    actual = id;
    const def = catalogo.find((c) => c.id === id);
    document.querySelectorAll(".report-card").forEach((c) => c.classList.toggle("sel", c.dataset.id === id));
    document.getElementById("campoDesde").classList.toggle("hidden", !def.usaFechas);
    document.getElementById("campoHasta").classList.toggle("hidden", !def.usaFechas);
    document.getElementById("campoEstado").classList.toggle("hidden", id !== "citas");
    vistaPrevia();
}

async function vistaPrevia() {
    const tabla = document.getElementById("tablaReporte");
    tabla.querySelector("tbody").innerHTML = '<tr><td><div class="empty"><span class="loader"></span></div></td></tr>';
    try {
        const d = await api(parametros("json"));
        document.getElementById("tituloReporte").textContent = d.titulo;
        document.getElementById("subReporte").textContent = d.subtitulo;
        document.getElementById("resumenReporte").innerHTML = (d.resumen || []).map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("");
        const cols = d.columnas.map((c) => ({
            titulo: c.titulo,
            clase: c.alinear === "right" ? "text-right" : "",
            render: (f) => {
                const v = f[c.clave];
                if (c.moneda) return `<span class="nowrap">${fmt.dinero(v)}</span>`;
                if (c.clave === "estado") return badge(v);
                if (c.clave === "fecha") return `<span class="nowrap">${fmt.fecha(v)}</span>`;
                if (["numero", "cedula", "hora", "telefono"].includes(c.clave)) return `<span class="nowrap">${esc(v)}</span>`;
                return esc(v);
            }
        }));
        tabla.querySelector("thead").innerHTML = "<tr>" + cols.map((c) => `<th class="${c.clase}">${c.titulo}</th>`).join("") + "</tr>";
        tabla.querySelector("tbody").innerHTML = filasTabla(cols, d.filas.slice(0, 300), "No hay datos para el período seleccionado.");
        tabla.querySelector("tfoot").innerHTML = d.totales
            ? "<tr>" + d.columnas.map((c, i) => `<td class="${c.alinear === "right" ? "text-right" : ""}" data-label="${esc(c.titulo)}">${i === 0 ? "TOTALES" : d.totales[c.clave] !== undefined ? (c.moneda ? fmt.dinero(d.totales[c.clave]) : d.totales[c.clave]) : ""}</td>`).join("") + "</tr>"
            : "";
        if (d.filas.length > 300) toast(`Vista previa limitada a 300 de ${d.filas.length} filas. El PDF/Excel incluye todas.`, "warn");
    } catch (e) { toast(e.message, "error"); }
}

document.getElementById("btnVista").onclick = vistaPrevia;
[r.desde, r.hasta, r.estado].forEach((el) => el.addEventListener("change", vistaPrevia));
document.getElementById("btnPDF").onclick = (e) => conCarga(e.currentTarget, () => descargar(parametros("pdf"), "reporte.pdf").then((n) => toast("Descargado: " + n)).catch((err) => toast(err.message, "error")));
document.getElementById("btnExcel").onclick = (e) => conCarga(e.currentTarget, () => descargar(parametros("xlsx"), "reporte.xlsx").then((n) => toast("Descargado: " + n)).catch((err) => toast(err.message, "error")));

(async () => {
    try {
        catalogo = await api("/reportes");
        document.getElementById("tiposReporte").innerHTML = catalogo.map((c) => `
            <button class="report-card" data-id="${c.id}"><span class="ico">${ICONOS[c.id]}</span><strong>${esc(c.titulo)}</strong><small>${DESCRIP[c.id]}</small></button>`).join("");
        document.querySelectorAll(".report-card").forEach((b) => b.onclick = () => seleccionar(b.dataset.id));
        seleccionar(actual);
    } catch (e) { toast(e.message, "error"); }
})();
