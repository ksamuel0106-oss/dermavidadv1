/* Historial clínico — consultar, editar datos clínicos, receta PDF y revertir atención */
const fDesde = document.getElementById("fDesde");
const fHasta = document.getElementById("fHasta");
fDesde.value = hoyISO(-60);

const crudConsultas = crearCRUD({
    ruta: "/consultas",
    id: "id_consulta",
    nombre: "la consulta",
    busquedaServidor: true,
    query: () => "?" + new URLSearchParams({ buscar: document.getElementById("buscar").value, desde: fDesde.value, hasta: fHasta.value }),
    puedeEditar: true,
    puedeEliminar: USUARIO.rol === "Administrador",
    etiqueta: (f) => `#${f.id_consulta} de ${f.paciente} (se eliminará también su factura y la cita volverá a Confirmada)`,
    acciones: (f) => `<button class="btn-icon" title="Ver consulta" data-ver="${f.id_consulta}">👁️</button><button class="btn-icon" title="Receta PDF" data-receta="${f.id_consulta}">💊</button> `,
    columnas: [
        { titulo: "Fecha", render: (f) => `<strong class="nowrap">${fmt.fechaTexto(f.fecha)}</strong><small>${fmt.hora12(f.hora)}</small>` },
        { titulo: "Paciente", render: (f) => `<strong>${esc(f.paciente)}</strong><small>${esc(f.cedula)} • ${f.edad} años</small>` },
        { titulo: "Diagnóstico", render: (f) => `<strong>${esc(f.diagnostico)}</strong><small>${esc(f.servicio)}</small>` },
        { titulo: "Dermatólogo", render: (f) => esc(f.dermatologo) },
        { titulo: "Próximo control", render: (f) => f.proximo_control ? fmt.fechaTexto(f.proximo_control) : '<span class="muted">—</span>' },
        { titulo: "Factura", render: (f) => f.factura ? `${f.factura}<small>${fmt.dinero(f.total)} ${f.estado_factura === "Anulada" ? "• Anulada" : ""}</small>` : "—" }
    ],
    titulo: () => "✏️ Editar registro clínico",
    formulario: () => `
        <div class="form-grid">
            <div class="field full"><label>Diagnóstico <span class="req">*</span></label><input class="input" name="diagnostico" required maxlength="300"></div>
            <div class="field full"><label>Tratamiento <span class="req">*</span></label><textarea class="input" name="tratamiento" required maxlength="500"></textarea></div>
            <div class="field full"><label>Receta</label><textarea class="input" name="receta"></textarea></div>
            <div class="field"><label>Observaciones</label><input class="input" name="observaciones"></div>
            <div class="field"><label>Próximo control</label><input class="input" type="date" name="proximo_control"></div>
        </div>
        <p class="hint" style="margin-top:12px">Los montos de la factura no se modifican desde aquí.</p>`
});

[fDesde, fHasta].forEach((el) => el.addEventListener("change", crudConsultas.cargar));

document.querySelector("#tabla tbody").addEventListener("click", async (e) => {
    const rec = e.target.closest("[data-receta]");
    const ver = e.target.closest("[data-ver]");
    try {
        if (rec) await descargar(`/consultas/${rec.dataset.receta}/receta`, "receta.pdf");
        if (ver) {
            const c = await api("/consultas/" + ver.dataset.ver);
            abrirModal({
                titulo: `📋 Consulta #${c.id_consulta}`,
                contenido: `
                    <div class="paciente-box"><span class="avatar">${fmt.iniciales(c.paciente)}</span>
                        <div class="datos"><strong>${esc(c.paciente)}</strong><span class="muted small">${esc(c.cedula)} • ${c.edad} años • Fototipo ${c.tipo_piel}</span>
                        ${c.alergias ? `<div class="tags"><span class="chip alerta-alergia">⚠ ${esc(c.alergias)}</span></div>` : ""}</div></div>
                    <p class="small muted">${fmt.fechaLarga(c.fecha)} • ${fmt.hora12(c.hora)} • ${esc(c.dermatologo)} • ${esc(c.servicio)}</p>
                    <div class="stack">
                        <div><b style="color:var(--primary)">Diagnóstico</b><div>${esc(c.diagnostico)}</div></div>
                        <div><b style="color:var(--primary)">Tratamiento</b><div>${esc(c.tratamiento)}</div></div>
                        <div><b style="color:var(--primary)">Receta</b><div style="white-space:pre-line">${esc(c.receta || "—")}</div></div>
                        <div><b style="color:var(--primary)">Observaciones</b><div>${esc(c.observaciones || "—")}</div></div>
                        <div><b style="color:var(--primary)">Próximo control</b><div>${c.proximo_control ? fmt.fechaLarga(c.proximo_control) : "—"}</div></div>
                    </div>`,
                botones: `<button class="btn btn-outline" onclick="descargar('/consultas/${c.id_consulta}/receta')">💊 Receta PDF</button><button class="btn btn-light" data-cerrar>Cerrar</button>`
            });
        }
    } catch (err) { toast(err.message, "error"); }
});
