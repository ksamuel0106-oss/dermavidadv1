/* Módulo Pacientes — CRUD completo + historial del paciente */
const SEGUROS = ["Ninguno", "ARS Humano", "ARS Universal", "SENASA", "ARS Mapfre Salud", "ARS Palic", "ARS Monumental", "ARS Futuro"];
const FOTOTIPOS = [["I", "I — Muy clara, siempre se quema"], ["II", "II — Clara, se quema con facilidad"], ["III", "III — Intermedia, a veces se quema"],
                   ["IV", "IV — Morena clara, rara vez se quema"], ["V", "V — Morena, muy rara vez se quema"], ["VI", "VI — Negra, nunca se quema"]];
const puedeEscribir = ["Administrador", "Recepción"].includes(USUARIO.rol);
if (!puedeEscribir) document.getElementById("btnNuevo").remove();

const crudPacientes = crearCRUD({
    ruta: "/pacientes",
    id: "id_paciente",
    nombre: "al paciente",
    busquedaServidor: true,
    query: () => "?buscar=" + encodeURIComponent(document.getElementById("buscar").value),
    puedeEditar: puedeEscribir,
    puedeEliminar: USUARIO.rol === "Administrador",
    etiqueta: (f) => `${f.nombre} ${f.apellido}`,
    acciones: (f) => `<button class="btn-icon" title="Ver historial" data-ver="${f.id_paciente}">👁️</button> `,
    columnas: [
        { titulo: "Paciente", render: (f) => `<div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="width:36px;height:36px;font-size:13px;background:${f.sexo === "F" ? "#B9707F" : "var(--primary)"}">${fmt.iniciales(f.nombre + " " + f.apellido)}</span><div><strong>${esc(f.nombre)} ${esc(f.apellido)}</strong><small>${esc(f.cedula)}</small></div></div>` },
        { titulo: "Edad / Sexo", render: (f) => `${f.edad} años • ${f.sexo === "F" ? "F" : "M"}` },
        { titulo: "Teléfono", clave: "telefono" },
        { titulo: "Seguro", render: (f) => f.seguro_medico === "Ninguno" ? '<span class="muted">Ninguno</span>' : `<span class="chip">${esc(f.seguro_medico)}</span>` },
        { titulo: "Fototipo", render: (f) => `<span class="chip">${f.tipo_piel}</span>` },
        { titulo: "Alergias", render: (f) => f.alergias ? `<span class="badge cancelada plain">⚠ ${esc(f.alergias)}</span>` : '<span class="muted">—</span>' },
        { titulo: "Citas", render: (f) => `<b>${f.total_citas}</b>` }
    ],
    titulo: (d) => d ? "✏️ Editar paciente" : "➕ Registro de nuevo paciente",
    tamanoModal: "lg",
    formulario: () => `
        <div class="form-grid cols-3">
            <div class="field"><label>Cédula <span class="req">*</span></label>
                <input class="input" name="cedula" required pattern="\\d{3}-\\d{7}-\\d" placeholder="000-0000000-0" maxlength="13">
                <span class="hint">Formato 000-0000000-0</span></div>
            <div class="field"><label>Nombre(s) <span class="req">*</span></label><input class="input" name="nombre" required maxlength="80"></div>
            <div class="field"><label>Apellidos <span class="req">*</span></label><input class="input" name="apellido" required maxlength="80"></div>
            <div class="field"><label>Fecha de nacimiento <span class="req">*</span></label><input class="input" type="date" name="fecha_nacimiento" required max="${hoyISO()}"></div>
            <div class="field"><label>Sexo <span class="req">*</span></label><select class="input" name="sexo" required><option value="">Seleccione...</option><option value="F">Femenino</option><option value="M">Masculino</option></select></div>
            <div class="field"><label>Teléfono <span class="req">*</span></label><input class="input" name="telefono" required placeholder="809-000-0000" maxlength="20"></div>
            <div class="field"><label>Correo electrónico</label><input class="input" type="email" name="correo" maxlength="120"></div>
            <div class="field"><label>Seguro médico (ARS)</label><select class="input" name="seguro_medico">${opciones(SEGUROS, (x) => x, (x) => x, "Ninguno", "")}</select></div>
            <div class="field"><label>Fototipo de piel (Fitzpatrick)</label><select class="input" name="tipo_piel">${opciones(FOTOTIPOS, (x) => x[0], (x) => x[1], "III", "")}</select></div>
            <div class="field full"><label>Dirección</label><input class="input" name="direccion" maxlength="200" placeholder="Sector, ciudad"></div>
            <div class="field full"><label>Alergias conocidas</label><input class="input" name="alergias" maxlength="250" placeholder="Ej. Penicilina, látex (dejar vacío si no tiene)"></div>
        </div>`,
    alAbrir: (form) => {
        // Formatea la cédula mientras se escribe
        form.elements.cedula.addEventListener("input", (e) => {
            const n = e.target.value.replace(/\D/g, "").slice(0, 11);
            e.target.value = n.length > 10 ? `${n.slice(0, 3)}-${n.slice(3, 10)}-${n.slice(10)}` : n.length > 3 ? `${n.slice(0, 3)}-${n.slice(3)}` : n;
        });
    }
});

/* Historial del paciente (consulta + relación con citas y consultas) */
document.querySelector("#tabla tbody").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ver]");
    if (!b) return;
    try {
        const p = await api("/pacientes/" + b.dataset.ver);
        abrirModal({
            titulo: "👤 Expediente del paciente",
            tamano: "lg",
            contenido: `
                <div class="paciente-box">
                    <span class="avatar">${fmt.iniciales(p.nombre + " " + p.apellido)}</span>
                    <div class="datos"><strong>${esc(p.nombre)} ${esc(p.apellido)}</strong>
                        <span class="muted small">${esc(p.cedula)} • ${p.edad} años • ${p.sexo === "F" ? "Femenino" : "Masculino"} • ${esc(p.telefono)}</span>
                        <div class="tags"><span class="chip">Fototipo ${p.tipo_piel}</span><span class="chip">${esc(p.seguro_medico)}</span>
                        ${p.alergias ? `<span class="chip alerta-alergia">⚠ Alergia: ${esc(p.alergias)}</span>` : ""}</div></div>
                </div>
                <h3 style="font-size:16px">Historial de citas (${p.historial.length})</h3>
                ${p.historial.length ? `<div class="timeline">${p.historial.map((h) => `
                    <div class="ev ${h.estado.toLowerCase()}">
                        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>${esc(h.servicio)}</strong>${badge(h.estado)}</div>
                        <small>${fmt.fechaTexto(h.fecha)} • ${fmt.hora12(h.hora.slice(0, 5))} • ${esc(h.dermatologo)}</small>
                        ${h.diagnostico ? `<div style="margin-top:4px"><b>Dx:</b> ${esc(h.diagnostico)}<br><span class="muted small">${esc(h.tratamiento)}</span></div>` : ""}
                    </div>`).join("")}</div>` : '<div class="empty">El paciente aún no tiene citas.</div>'}`
        });
    } catch (err) { toast(err.message, "error"); }
});

if (new URLSearchParams(location.search).has("nuevo") && puedeEscribir) crudPacientes.abrirFormulario();
