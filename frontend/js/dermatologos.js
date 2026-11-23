/* Módulo Dermatólogos — CRUD */
const ESPECIALIDADES = ["Dermatología Clínica", "Dermatología Oncológica", "Dermatología Estética", "Cirugía Dermatológica", "Dermatología Pediátrica", "Tricología", "Dermatopatología"];
const esAdmin = USUARIO.rol === "Administrador";
if (!esAdmin) document.getElementById("btnNuevo").remove();

crearCRUD({
    ruta: "/dermatologos",
    id: "id_dermatologo",
    nombre: "al dermatólogo",
    puedeEditar: esAdmin,
    puedeEliminar: esAdmin,
    etiqueta: (f) => `${f.nombre} ${f.apellido}`,
    filtrar: (f, t) => `${f.nombre} ${f.apellido} ${f.especialidad} ${f.exequatur}`.toLowerCase().includes(t),
    columnas: [
        { titulo: "Dermatólogo", render: (f) => `<div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="width:36px;height:36px;font-size:13px">${fmt.iniciales(f.nombre + " " + f.apellido)}</span><div><strong>${esc(f.nombre)} ${esc(f.apellido)}</strong><small>${esc(f.correo || "")}</small></div></div>` },
        { titulo: "Especialidad", render: (f) => esc(f.especialidad) },
        { titulo: "Exequátur", render: (f) => `<span class="chip">${esc(f.exequatur)}</span>` },
        { titulo: "Teléfono", render: (f) => esc(f.telefono || "—") },
        { titulo: "Horario", render: (f) => `<span class="nowrap">${fmt.hora12(f.horario_inicio.slice(0, 5))} – ${fmt.hora12(f.horario_fin.slice(0, 5))}</span>` },
        { titulo: "Atendidas / Próximas", render: (f) => `<b>${f.atendidas}</b> / ${f.proximas}` },
        { titulo: "Estado", render: (f) => badge(f.activo ? "Activo" : "Inactivo") }
    ],
    titulo: (d) => d ? "✏️ Editar dermatólogo" : "➕ Nuevo dermatólogo",
    formulario: () => `
        <div class="form-grid">
            <div class="field"><label>Nombre(s) <span class="req">*</span></label><input class="input" name="nombre" required></div>
            <div class="field"><label>Apellidos <span class="req">*</span></label><input class="input" name="apellido" required></div>
            <div class="field"><label>Especialidad <span class="req">*</span></label><select class="input" name="especialidad" required>${opciones(ESPECIALIDADES, (x) => x, (x) => x)}</select></div>
            <div class="field"><label>Exequátur <span class="req">*</span></label><input class="input" name="exequatur" required placeholder="EXQ-00000"></div>
            <div class="field"><label>Teléfono</label><input class="input" name="telefono"></div>
            <div class="field"><label>Correo</label><input class="input" type="email" name="correo"></div>
            <div class="field"><label>Hora de entrada</label><input class="input" type="time" name="horario_inicio" value="08:00" required></div>
            <div class="field"><label>Hora de salida</label><input class="input" type="time" name="horario_fin" value="17:00" required></div>
            <div class="field full"><label class="check"><input type="checkbox" name="activo" checked> Activo (disponible para agendar citas)</label></div>
        </div>`
});
