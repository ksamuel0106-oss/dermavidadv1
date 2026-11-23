/* =====================================================================
   PROCESO 2 — ATENCIÓN DERMATOLÓGICA Y FACTURACIÓN
   1) Seleccionar cita  2) Registrar consulta  3) Cobrar -> factura
   Todo se guarda en una sola transacción en el servidor.
   ===================================================================== */
const lista = document.getElementById("listaPendientes");
const panel = document.getElementById("panelAtencion");
let pendientes = [];
let seleccion = null;

const DIAGNOSTICOS = ["Acné vulgar inflamatorio", "Acné comedoniano", "Dermatitis atópica", "Dermatitis seborreica", "Dermatitis de contacto",
    "Melasma", "Rosácea", "Psoriasis en placas", "Urticaria crónica", "Nevus melanocítico benigno", "Nevus atípico", "Queratosis actínica",
    "Queratosis seborreica", "Verruga vulgar", "Onicomicosis", "Tiña corporis", "Pitiriasis versicolor", "Vitíligo", "Alopecia areata",
    "Quiste epidérmico", "Lipoma subcutáneo", "Xerosis cutánea", "Hiperhidrosis axilar", "Cicatrices post-acné"];

function pasos(n) {
    [1, 2, 3].forEach((i) => document.getElementById("paso" + i).classList.toggle("on", i <= n));
}

async function cargarPendientes() {
    try {
        pendientes = await api("/consultas/pendientes");
        document.getElementById("totalPendientes").textContent = pendientes.length;
        if (!pendientes.length) {
            lista.innerHTML = '<div class="empty"><span class="big">🎉</span>No hay pacientes pendientes de atención hoy.</div>';
            return;
        }
        lista.innerHTML = pendientes.map((c) => `
            <button class="cita-card ${seleccion?.id_cita === c.id_cita ? "sel" : ""}" data-id="${c.id_cita}">
                <div class="row1"><span>${esc(c.paciente)}</span><span style="color:var(--primary)">${fmt.hora12(c.hora)}</span></div>
                <small>${esc(c.servicio)}</small>
                <small>${c.fecha < hoyISO() ? "⚠️ Atrasada • " : ""}${fmt.fechaTexto(c.fecha)} • ${esc(c.dermatologo)}</small>
                <div style="margin-top:4px">${badge(c.estado)} ${c.alergias ? '<span class="badge cancelada plain">⚠ Alergia</span>' : ""}</div>
            </button>`).join("");
    } catch (e) { toast(e.message, "error"); }
}

lista.addEventListener("click", (e) => {
    const b = e.target.closest(".cita-card");
    if (!b) return;
    seleccion = pendientes.find((c) => String(c.id_cita) === b.dataset.id);
    lista.querySelectorAll(".cita-card").forEach((x) => x.classList.toggle("sel", x === b));
    pintarFormulario();
    if (window.innerWidth < 992) panel.scrollIntoView({ behavior: "smooth" });
});

function pintarFormulario() {
    const c = seleccion;
    const tieneSeguro = c.seguro_medico !== "Ninguno";
    pasos(2);
    panel.innerHTML = `
        <div class="paciente-box">
            <span class="avatar">${fmt.iniciales(c.paciente)}</span>
            <div class="datos"><strong>${esc(c.paciente)}</strong>
                <span class="muted small">${esc(c.cedula)} • ${c.edad} años • Cita ${fmt.fechaTexto(c.fecha)} ${fmt.hora12(c.hora)}</span>
                <div class="tags"><span class="chip">Fototipo ${c.tipo_piel}</span><span class="chip">🛡️ ${esc(c.seguro_medico)}</span>
                ${c.alergias ? `<span class="chip alerta-alergia">⚠ Alergia: ${esc(c.alergias)}</span>` : '<span class="chip">Sin alergias conocidas</span>'}</div>
            </div>
        </div>
        <p class="small"><b>Servicio:</b> ${esc(c.servicio)} &nbsp;•&nbsp; <b>Dermatólogo:</b> ${esc(c.dermatologo)}<br><b>Motivo:</b> ${esc(c.motivo || "—")}</p>

        <form id="formAtencion" novalidate>
            <fieldset>
                <legend>🩺 Registro clínico</legend>
                <div class="form-grid">
                    <div class="field full"><label>Diagnóstico <span class="req">*</span></label>
                        <input class="input" name="diagnostico" list="dxList" required maxlength="300" placeholder="Escriba o seleccione un diagnóstico">
                        <datalist id="dxList">${DIAGNOSTICOS.map((d) => `<option value="${d}">`).join("")}</datalist></div>
                    <div class="field full"><label>Tratamiento indicado <span class="req">*</span></label>
                        <textarea class="input" name="tratamiento" required maxlength="500" rows="2" placeholder="Procedimiento realizado y plan de manejo"></textarea></div>
                    <div class="field full"><label>Receta (medicamentos, dosis y duración)</label>
                        <textarea class="input" name="receta" rows="3" placeholder="Ej. Adapaleno 0.1% gel — aplicar en la noche por 8 semanas"></textarea></div>
                    <div class="field"><label>Observaciones</label><input class="input" name="observaciones"></div>
                    <div class="field"><label>Próximo control</label><input class="input" type="date" name="proximo_control" min="${hoyISO(1)}"></div>
                </div>
            </fieldset>
            <fieldset style="margin-top:16px">
                <legend>💳 Cobro y facturación</legend>
                <div class="grid-half">
                    <div class="stack">
                        <div class="field"><label>Cobertura del seguro (RD$)</label>
                            <input class="input" type="number" name="cobertura_seguro" min="0" max="${c.precio}" step="10" value="0" ${tieneSeguro ? "" : "disabled"}>
                            <span class="hint">${tieneSeguro ? `Autorización de ${esc(c.seguro_medico)}. <a href="#" data-cob="0.5">50%</a> · <a href="#" data-cob="0.7">70%</a> · <a href="#" data-cob="0.8">80%</a>` : "El paciente no tiene seguro registrado."}</span></div>
                        <div class="field"><label>Descuento (RD$)</label><input class="input" type="number" name="descuento" min="0" step="50" value="0"></div>
                        <div class="field"><label>Método de pago <span class="req">*</span></label>
                            <select class="input" name="metodo_pago" required><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option>${tieneSeguro ? "<option>Seguro</option>" : ""}</select></div>
                    </div>
                    <div class="totales">
                        <div class="linea"><span>Servicio</span><span class="small muted" style="text-align:right">${esc(c.servicio)}</span></div>
                        <div class="linea"><span>Subtotal</span><b>${fmt.dinero(c.precio)}</b></div>
                        <div class="linea"><span>(-) Cobertura seguro</span><span id="tCob">${fmt.dinero(0)}</span></div>
                        <div class="linea"><span>(-) Descuento</span><span id="tDes">${fmt.dinero(0)}</span></div>
                        <div class="linea total"><span>Total a pagar</span><span id="tTotal">${fmt.dinero(c.precio)}</span></div>
                        <p class="hint" style="margin:8px 0 0">Servicios de salud exentos de ITBIS.</p>
                    </div>
                </div>
            </fieldset>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
                <button type="button" class="btn btn-light" id="btnLimpiar">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="btnFinalizar">✅ Finalizar atención y generar factura</button>
            </div>
        </form>`;

    const form = panel.querySelector("#formAtencion");
    const recalcular = () => {
        const cob = Math.max(0, Number(form.elements.cobertura_seguro.value || 0));
        const des = Math.max(0, Number(form.elements.descuento.value || 0));
        const total = c.precio - cob - des;
        panel.querySelector("#tCob").textContent = "- " + fmt.dinero(cob);
        panel.querySelector("#tDes").textContent = "- " + fmt.dinero(des);
        const t = panel.querySelector("#tTotal");
        t.textContent = fmt.dinero(total);
        t.style.color = total < 0 ? "var(--danger-hover)" : "";
        pasos(cob || des ? 3 : 2);
    };
    form.addEventListener("input", recalcular);
    panel.querySelectorAll("[data-cob]").forEach((a) => a.onclick = (e) => {
        e.preventDefault();
        form.elements.cobertura_seguro.value = Math.round(c.precio * Number(a.dataset.cob));
        recalcular();
    });
    panel.querySelector("#btnLimpiar").onclick = () => {
        seleccion = null;
        lista.querySelectorAll(".cita-card").forEach((x) => x.classList.remove("sel"));
        panel.innerHTML = '<div class="empty" style="padding:70px 10px"><span class="big">👈</span>Seleccione una cita de la lista para iniciar la atención.</div>';
        pasos(1);
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const d = datosFormulario(form);
        const total = c.precio - Number(d.cobertura_seguro || 0) - Number(d.descuento || 0);
        if (total < 0) return toast("La cobertura más el descuento no pueden superar el subtotal.", "error");
        if (!(await confirmar(`Se registrará la consulta de <b>${esc(c.paciente)}</b> y se generará una factura por <b>${fmt.dinero(total)}</b> (${esc(d.metodo_pago)}).`,
            { titulo: "Finalizar atención", textoOk: "Finalizar y facturar", peligro: false }))) return;
        try {
            const r = await conCarga(panel.querySelector("#btnFinalizar"), () =>
                api("/consultas", { method: "POST", body: { ...d, id_cita: c.id_cita, cobertura_seguro: Number(d.cobertura_seguro || 0), descuento: Number(d.descuento || 0) } }));
            pasos(3);
            mostrarResultado(r.datos, c);
            seleccion = null;
            panel.innerHTML = '<div class="empty" style="padding:70px 10px"><span class="big">✅</span>Atención registrada. Seleccione la siguiente cita.</div>';
            cargarPendientes();
        } catch (err) { toast(err.message, "error"); }
    });
}

function mostrarResultado(d, c) {
    const m = abrirModal({
        titulo: "✅ Atención finalizada",
        tamano: "sm",
        contenido: `
            <div class="text-center">
                <div style="font-size:46px">🧾</div>
                <h3 style="margin-bottom:2px">Factura ${d.numero}</h3>
                <p class="muted">${esc(c.paciente)} • ${esc(c.servicio)}</p>
                <div class="totales" style="margin-bottom:14px"><div class="linea total" style="border:0;margin:0;padding:0"><span>Total cobrado</span><span>${fmt.dinero(d.total)}</span></div></div>
                <div style="display:grid;gap:8px">
                    <button class="btn btn-primary" id="dlFactura">📄 Descargar factura (PDF)</button>
                    <button class="btn btn-outline" id="dlReceta">💊 Descargar receta (PDF)</button>
                </div>
            </div>`,
        botones: `<button class="btn btn-light" data-cerrar>Cerrar</button>`
    });
    m.el.querySelector("#dlFactura").onclick = () => descargar(`/facturas/${d.id_factura}/pdf`, "factura.pdf").catch((e) => toast(e.message, "error"));
    m.el.querySelector("#dlReceta").onclick = () => descargar(`/consultas/${d.id_consulta}/receta`, "receta.pdf").catch((e) => toast(e.message, "error"));
}

cargarPendientes();
