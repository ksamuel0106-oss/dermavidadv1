/* Facturación — consulta, PDF y anulación */
const fl = { desde: document.getElementById("fDesde"), hasta: document.getElementById("fHasta"), metodo: document.getElementById("fMetodo"), estado: document.getElementById("fEstado") };
fl.desde.value = hoyISO().slice(0, 8) + "01";
fl.hasta.value = hoyISO();

const crudFacturas = crearCRUD({
    ruta: "/facturas",
    id: "id_factura",
    nombre: "la factura",
    busquedaServidor: true,
    query: () => "?" + new URLSearchParams({ buscar: document.getElementById("buscar").value, desde: fl.desde.value, hasta: fl.hasta.value, metodo: fl.metodo.value, estado: fl.estado.value }),
    acciones: (f) => `<button class="btn-icon" title="Descargar PDF" data-pdf="${f.id_factura}">📄</button>` +
        (USUARIO.rol === "Administrador" && f.estado === "Pagada" ? `<button class="btn-icon danger" title="Anular factura" data-anular="${f.id_factura}">⛔</button>` : ""),
    columnas: [
        { titulo: "Factura", render: (f) => `<strong>${f.numero}</strong><small>${fmt.fecha(f.fecha_texto)} ${f.fecha_texto.slice(11)}</small>` },
        { titulo: "Paciente", render: (f) => `<strong>${esc(f.paciente)}</strong><small>${esc(f.cedula)}</small>` },
        { titulo: "Servicio", render: (f) => `${esc(f.servicio)}<small>${esc(f.dermatologo)}</small>` },
        { titulo: "Subtotal", clase: "text-right", render: (f) => `<span class="nowrap">${fmt.dinero(f.subtotal)}</span>` },
        { titulo: "Seguro / Desc.", clase: "text-right", render: (f) => `<span class="muted nowrap">-${fmt.dinero(f.cobertura_seguro)}<br>-${fmt.dinero(f.descuento)}</span>` },
        { titulo: "Total", clase: "text-right", render: (f) => `<b class="nowrap">${fmt.dinero(f.total)}</b>` },
        { titulo: "Pago", render: (f) => `<span class="chip">${esc(f.metodo_pago)}</span>` },
        { titulo: "Estado", render: (f) => badge(f.estado) }
    ]
});

// Resumen superior (se recalcula al cargar)
const observar = new MutationObserver(() => {
    const regs = crudFacturas.registros();
    const pag = regs.filter((r) => r.estado === "Pagada");
    const suma = (k) => pag.reduce((s, r) => s + r[k], 0);
    document.getElementById("resumenFacturas").innerHTML = `
        <div><small>Facturas pagadas</small><b>${pag.length}</b></div>
        <div><small>Ingreso neto</small><b>${fmt.dinero(suma("total"))}</b></div>
        <div><small>Cubierto por seguros</small><b>${fmt.dinero(suma("cobertura_seguro"))}</b></div>
        <div><small>Descuentos</small><b>${fmt.dinero(suma("descuento"))}</b></div>
        <div><small>Anuladas</small><b>${regs.length - pag.length}</b></div>`;
});
observar.observe(document.querySelector("#tabla tbody"), { childList: true });

Object.values(fl).forEach((el) => el.addEventListener("change", crudFacturas.cargar));

document.querySelector("#tabla tbody").addEventListener("click", async (e) => {
    const pdf = e.target.closest("[data-pdf]");
    const an = e.target.closest("[data-anular]");
    try {
        if (pdf) await descargar(`/facturas/${pdf.dataset.pdf}/pdf`, "factura.pdf");
        if (an) {
            const f = crudFacturas.registros().find((x) => String(x.id_factura) === an.dataset.anular);
            if (!(await confirmar(`¿Anular la factura <b>${f.numero}</b> por ${fmt.dinero(f.total)}? Dejará de contar en los ingresos.`, { textoOk: "Anular factura" }))) return;
            toast((await api(`/facturas/${f.id_factura}/anular`, { method: "PATCH" })).mensaje);
            crudFacturas.cargar();
        }
    } catch (err) { toast(err.message, "error"); }
});
