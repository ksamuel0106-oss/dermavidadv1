/* =====================================================================
   PROCESO 1 — AGENDAMIENTO DE CITAS
   Paciente + servicio + dermatólogo + fecha  ->  horarios disponibles
   (calculados por el servidor según horario y citas existentes)
   ===================================================================== */
const puedeAgendar = ["Administrador", "Recepción"].includes(USUARIO.rol);
const tbody = document.querySelector("#tabla tbody");
const f = {
    buscar: document.getElementById("buscar"),
    desde: document.getElementById("fDesde"),
    hasta: document.getElementById("fHasta"),
    estado: document.getElementById("fEstado"),
    derm: document.getElementById("fDerm")
};
let CAT = { pacientes: [], dermatologos: [], servicios: [] };
let citas = [];

if (!puedeAgendar) document.getElementById("btnNuevo").remove();
f.desde.value = hoyISO();
f.hasta.value = hoyISO(30);

const COLUMNAS = [
    { titulo: "Fecha y hora", render: (c) => `<strong class="nowrap">${fmt.fechaTexto(c.fecha)}</strong><small>${fmt.hora12(c.hora)} – ${fmt.hora12(c.hora_fin)}</small>` },
    { titulo: "Paciente", render: (c) => `<strong>${esc(c.paciente)}</strong><small>${esc(c.cedula)} • ${esc(c.telefono)}</small>` },
    { titulo: "Dermatólogo", render: (c) => `${esc(c.dermatologo)}<small>${esc(c.especialidad)}</small>` },
    { titulo: "Servicio", render: (c) => `${esc(c.servicio)}<small>${c.duracion_min} min • ${fmt.dinero(c.precio)}</small>` },
    { titulo: "Estado", render: (c) => badge(c.estado) + (c.factura ? `<small>${c.factura}</small>` : "") },
    { titulo: "Acciones", clase: "acciones", render: acciones }
];
document.querySelector("#tabla thead").innerHTML = "<tr>" + COLUMNAS.map((c) => `<th class="${c.clase || ""}">${c.titulo}</th>`).join("") + "</tr>";

function acciones(c) {
    let h = `<button class="btn-icon" title="Ver detalle" data-acc="ver" data-id="${c.id_cita}">👁️</button>`;
    if (puedeAgendar && ["Pendiente", "Confirmada"].includes(c.estado)) {
        if (c.estado === "Pendiente") h += `<button class="btn-icon" title="Confirmar cita" data-acc="Confirmada" data-id="${c.id_cita}">✅</button>`;
        h += `<button class="btn-icon" title="Reprogramar / editar" data-acc="editar" data-id="${c.id_cita}">✏️</button>`;
        h += `<button class="btn-icon danger" title="Cancelar cita" data-acc="Cancelada" data-id="${c.id_cita}">🚫</button>`;
    }
    if (c.id_factura && USUARIO.rol !== "Dermatólogo") h += `<button class="btn-icon" title="Factura PDF" data-acc="factura" data-id="${c.id_factura}">🧾</button>`;
    if (puedeAgendar && c.estado !== "Atendida") h += `<button class="btn-icon danger" title="Eliminar" data-acc="eliminar" data-id="${c.id_cita}">🗑️</button>`;
    return h;
}

async function cargarCatalogos() {
    const [pacientes, dermatologos, servicios] = await Promise.all([api("/pacientes"), api("/dermatologos?activos=1"), api("/servicios?activos=1")]);
    CAT = { pacientes, dermatologos, servicios };
    f.derm.innerHTML = opciones(dermatologos, "id_dermatologo", (d) => `${d.nombre} ${d.apellido}`, "", "Todos");
    if (USUARIO.rol === "Dermatólogo" && USUARIO.id_dermatologo) f.derm.value = USUARIO.id_dermatologo;
}

async function cargar() {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty"><span class="loader"></span></div></td></tr>`;
    const q = new URLSearchParams({ desde: f.desde.value, hasta: f.hasta.value, estado: f.estado.value, id_dermatologo: f.derm.value, buscar: f.buscar.value });
    try {
        citas = await api("/citas?" + q);
        citas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
        tbody.innerHTML = filasTabla(COLUMNAS, citas, "No hay citas para los filtros seleccionados.");
        const cuenta = (e) => citas.filter((c) => c.estado === e).length;
        document.getElementById("infoTabla").innerHTML = `<span><b>${citas.length}</b> citas</span>
            <span>${badge("Pendiente")} ${cuenta("Pendiente")} &nbsp; ${badge("Confirmada")} ${cuenta("Confirmada")} &nbsp; ${badge("Atendida")} ${cuenta("Atendida")} &nbsp; ${badge("Cancelada")} ${cuenta("Cancelada")}</span>`;
    } catch (e) { toast(e.message, "error"); }
}

/* ---------------- Formulario de agendamiento ---------------- */
async function abrirFormulario(id = null) {
    let cita = null;
    if (id) {
        try { cita = await api("/citas/" + id); } catch (e) { return toast(e.message, "error"); }
    }
    const m = abrirModal({
        titulo: cita ? "✏️ Reprogramar cita #" + cita.id_cita : "📅 Agendar nueva cita",
        tamano: "lg",
        contenido: `
        <form id="formCita" novalidate>
          <div class="grid-half">
            <div class="stack">
              <div class="field"><label>Paciente <span class="req">*</span></label>
                <input class="input" id="filtroPac" placeholder="🔍 Filtrar por nombre o cédula..." style="margin-bottom:6px">
                <select class="input" name="id_paciente" required size="5" style="height:auto"></select>
                <span class="hint">¿No existe? <a href="pacientes.html?nuevo=1">Registrar paciente</a></span></div>
              <div class="field"><label>Servicio <span class="req">*</span></label>
                <select class="input" name="id_servicio" required>${opciones(CAT.servicios, "id_servicio", (s) => `${s.nombre} — ${s.duracion_min} min — ${fmt.dinero(s.precio)}`)}</select></div>
              <div class="field"><label>Dermatólogo <span class="req">*</span></label>
                <select class="input" name="id_dermatologo" required>${opciones(CAT.dermatologos, "id_dermatologo", (d) => `${d.nombre} ${d.apellido} — ${d.especialidad}`)}</select></div>
              <div class="form-grid">
                <div class="field"><label>Fecha <span class="req">*</span></label><input class="input" type="date" name="fecha" min="${hoyISO()}" required></div>
                <div class="field"><label>Estado inicial</label><select class="input" name="estado"><option>Pendiente</option><option>Confirmada</option></select></div>
              </div>
              <div class="field"><label>Motivo de consulta</label><textarea class="input" name="motivo" maxlength="250" rows="2" placeholder="Ej. Manchas en el rostro desde hace 3 meses"></textarea></div>
            </div>
            <div>
              <div class="field"><label>Horarios disponibles <span class="req">*</span></label></div>
              <input type="hidden" name="hora">
              <div id="zonaHorarios" class="card surface" style="padding:14px;min-height:260px">
                <div class="empty"><span class="big">🕘</span>Seleccione servicio, dermatólogo y fecha para ver la disponibilidad.</div>
              </div>
              <div id="resumenCita" class="alert alert-ok hidden" style="margin-top:12px"></div>
            </div>
          </div>
        </form>`,
        botones: `<button class="btn btn-light" data-cerrar>Cancelar</button><button class="btn btn-primary" id="btnGuardarCita">📅 ${cita ? "Guardar cambios" : "Agendar cita"}</button>`
    });

    const form = m.el.querySelector("#formCita");
    const selPac = form.elements.id_paciente;
    const pintarPacientes = (txt = "") => {
        const t = txt.toLowerCase();
        const lista = CAT.pacientes.filter((p) => `${p.nombre} ${p.apellido} ${p.cedula}`.toLowerCase().includes(t));
        const actual = selPac.value;
        selPac.innerHTML = opciones(lista, "id_paciente", (p) => `${p.nombre} ${p.apellido} — ${p.cedula}${p.alergias ? " ⚠" : ""}`, actual, "");
        if (lista.length === 1) selPac.value = lista[0].id_paciente;
    };
    pintarPacientes();
    m.el.querySelector("#filtroPac").addEventListener("input", (e) => pintarPacientes(e.target.value));

    if (cita) {
        llenarFormulario(form, { id_paciente: cita.id_paciente, id_servicio: cita.id_servicio, id_dermatologo: cita.id_dermatologo, fecha: cita.fecha, estado: cita.estado, motivo: cita.motivo, hora: cita.hora });
        if (cita.fecha < hoyISO()) form.elements.fecha.min = "";
    } else {
        // Sugerir el próximo día hábil
        let d = 0; while (new Date(hoyISO(d) + "T12:00").getDay() === 0) d++;
        form.elements.fecha.value = hoyISO(d);
    }

    const zona = m.el.querySelector("#zonaHorarios");
    const resumen = m.el.querySelector("#resumenCita");

    function actualizarResumen() {
        const h = form.elements.hora.value;
        if (!h) { resumen.classList.add("hidden"); return; }
        const s = CAT.servicios.find((x) => String(x.id_servicio) === form.elements.id_servicio.value);
        const d = CAT.dermatologos.find((x) => String(x.id_dermatologo) === form.elements.id_dermatologo.value);
        const [hh, mm] = h.split(":").map(Number);
        const fin = hh * 60 + mm + (s?.duracion_min || 0);
        resumen.innerHTML = `✅ <b>${fmt.fechaLarga(form.elements.fecha.value)}</b><br>${fmt.hora12(h)} – ${fmt.hora12(`${Math.floor(fin / 60)}:${String(fin % 60).padStart(2, "0")}`)} con ${esc(d ? d.nombre + " " + d.apellido : "")}`;
        resumen.classList.remove("hidden");
    }

    async function cargarHorarios() {
        const { id_servicio, id_dermatologo, fecha } = form.elements;
        if (!id_servicio.value || !id_dermatologo.value || !fecha.value) return;
        zona.innerHTML = '<div class="empty"><span class="loader"></span></div>';
        try {
            const q = new URLSearchParams({ id_servicio: id_servicio.value, id_dermatologo: id_dermatologo.value, fecha: fecha.value, excluir: cita?.id_cita || 0 });
            const r = await api("/citas/disponibilidad?" + q);
            if (r.domingo) {
                zona.innerHTML = '<div class="empty"><span class="big">🚫</span>La clínica no atiende los domingos.</div>';
                form.elements.hora.value = ""; actualizarResumen(); return;
            }
            const libres = r.horarios.filter((h) => h.disponible).length;
            if (!r.horarios.some((h) => h.hora === form.elements.hora.value && h.disponible)) form.elements.hora.value = "";
            zona.innerHTML = `
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:13px"><b>${fmt.fechaLarga(r.fecha)}</b><span class="muted">Horario: ${r.horario}</span></div>
                ${libres ? "" : '<div class="alert alert-error">No quedan horarios libres este día. Pruebe otra fecha.</div>'}
                <div class="slots">${r.horarios.map((h) => `<button type="button" class="slot ${h.hora === form.elements.hora.value ? "sel" : ""}" data-h="${h.hora}" ${h.disponible ? "" : "disabled"}>${fmt.hora12(h.hora)}</button>`).join("")}</div>
                <div class="slots-info"><span>🟩 ${libres} disponibles</span><span>▨ ocupado / no disponible</span><span>⏱ Bloque de ${r.duracion} min</span></div>`;
            zona.querySelectorAll(".slot:not(:disabled)").forEach((b) => b.onclick = () => {
                zona.querySelectorAll(".slot").forEach((x) => x.classList.remove("sel"));
                b.classList.add("sel");
                form.elements.hora.value = b.dataset.h;
                actualizarResumen();
            });
            actualizarResumen();
        } catch (e) {
            zona.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`;
        }
    }
    ["id_servicio", "id_dermatologo", "fecha"].forEach((n) => form.elements[n].addEventListener("change", cargarHorarios));
    cargarHorarios();

    m.el.querySelector("#btnGuardarCita").onclick = async (e) => {
        if (!form.reportValidity()) return;
        if (!form.elements.hora.value) return toast("Seleccione un horario disponible.", "warn");
        const datos = datosFormulario(form);
        try {
            const r = await conCarga(e.currentTarget, () => api(cita ? "/citas/" + cita.id_cita : "/citas", { method: cita ? "PUT" : "POST", body: datos }));
            toast(r.mensaje);
            m.cerrar();
            f.desde.value = datos.fecha < f.desde.value ? datos.fecha : f.desde.value;
            cargar();
        } catch (err) {
            toast(err.message, "error");
            cargarHorarios();
        }
    };
}

function verDetalle(c) {
    abrirModal({
        titulo: `📄 Cita #${c.id_cita}`,
        contenido: `
            <div class="paciente-box"><span class="avatar">${fmt.iniciales(c.paciente)}</span>
                <div class="datos"><strong>${esc(c.paciente)}</strong><span class="muted small">${esc(c.cedula)} • ${esc(c.telefono)} • ${esc(c.seguro_medico)}</span></div>${badge(c.estado)}</div>
            <div class="form-grid">
                <div><small class="muted">Fecha</small><div><b>${fmt.fechaLarga(c.fecha)}</b></div></div>
                <div><small class="muted">Horario</small><div><b>${fmt.hora12(c.hora)} – ${fmt.hora12(c.hora_fin)}</b></div></div>
                <div><small class="muted">Dermatólogo</small><div>${esc(c.dermatologo)}<br><span class="small muted">${esc(c.especialidad)}</span></div></div>
                <div><small class="muted">Servicio</small><div>${esc(c.servicio)}<br><span class="small muted">${c.duracion_min} min • ${fmt.dinero(c.precio)}</span></div></div>
                <div class="full"><small class="muted">Motivo</small><div>${esc(c.motivo || "—")}</div></div>
                ${c.factura ? `<div class="full"><small class="muted">Factura</small><div><b>${c.factura}</b></div></div>` : ""}
            </div>`
    });
}

tbody.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-acc]");
    if (!b) return;
    const id = b.dataset.id, acc = b.dataset.acc;
    const c = citas.find((x) => String(x.id_cita) === id);
    try {
        if (acc === "ver") verDetalle(c);
        else if (acc === "editar") abrirFormulario(id);
        else if (acc === "factura") await descargar(`/facturas/${id}/pdf`, "factura.pdf");
        else if (acc === "eliminar") {
            if (!(await confirmar(`¿Eliminar definitivamente la cita de <b>${esc(c.paciente)}</b> del ${fmt.fechaTexto(c.fecha)}?`, { textoOk: "Eliminar" }))) return;
            toast((await api("/citas/" + id, { method: "DELETE" })).mensaje); cargar();
        } else {
            const txt = acc === "Cancelada" ? `¿Cancelar la cita de <b>${esc(c.paciente)}</b>? El horario quedará libre.` : `¿Confirmar la asistencia de <b>${esc(c.paciente)}</b>?`;
            if (!(await confirmar(txt, { textoOk: acc === "Cancelada" ? "Cancelar cita" : "Confirmar", peligro: acc === "Cancelada" }))) return;
            toast((await api(`/citas/${id}/estado`, { method: "PATCH", body: { estado: acc } })).mensaje); cargar();
        }
    } catch (err) { toast(err.message, "error"); }
});

document.querySelectorAll("[data-rango]").forEach((b) => b.onclick = () => {
    const r = b.dataset.rango;
    f.desde.value = r === "todo" ? "" : hoyISO();
    f.hasta.value = r === "hoy" ? hoyISO() : r === "semana" ? hoyISO(7) : "";
    cargar();
});
[f.desde, f.hasta, f.estado, f.derm].forEach((el) => el.addEventListener("change", cargar));
f.buscar.addEventListener("input", debounce(cargar, 350));
document.getElementById("btnNuevo")?.addEventListener("click", () => abrirFormulario());

(async () => {
    try { await cargarCatalogos(); } catch (e) { toast(e.message, "error"); }
    await cargar();
    if (new URLSearchParams(location.search).has("nueva") && puedeAgendar) abrirFormulario();
})();
