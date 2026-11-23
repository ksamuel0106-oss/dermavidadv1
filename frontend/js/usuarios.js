/* Módulo Usuarios (solo Administrador) */
let DERMATOLOGOS = [];
api("/dermatologos").then((d) => (DERMATOLOGOS = d)).catch(() => {});

crearCRUD({
    ruta: "/usuarios",
    id: "id_usuario",
    nombre: "al usuario",
    puedeEditar: true,
    puedeEliminar: true,
    etiqueta: (f) => f.nombre,
    filtrar: (f, t) => `${f.nombre} ${f.correo}`.toLowerCase().includes(t),
    columnas: [
        { titulo: "Usuario", render: (f) => `<div style="display:flex;gap:10px;align-items:center"><span class="avatar" style="width:36px;height:36px;font-size:13px">${fmt.iniciales(f.nombre)}</span><div><strong>${esc(f.nombre)}</strong><small>${esc(f.correo)}</small></div></div>` },
        { titulo: "Rol", render: (f) => `<span class="chip">${{ "Administrador": "🛡️", "Recepción": "🗂️", "Dermatólogo": "🩺" }[f.rol]} ${esc(f.rol)}</span>` },
        { titulo: "Dermatólogo vinculado", render: (f) => esc(f.dermatologo || "—") },
        { titulo: "Último acceso", render: (f) => f.ultimo_acceso ? `${fmt.fecha(f.ultimo_acceso)} ${f.ultimo_acceso.slice(11, 16)}` : '<span class="muted">Nunca</span>' },
        { titulo: "Estado", render: (f) => badge(f.activo ? "Activo" : "Inactivo") }
    ],
    titulo: (d) => d ? "✏️ Editar usuario" : "➕ Nuevo usuario",
    formulario: (d) => `
        <div class="form-grid">
            <div class="field full"><label>Nombre completo <span class="req">*</span></label><input class="input" name="nombre" required></div>
            <div class="field"><label>Correo (usuario) <span class="req">*</span></label><input class="input" type="email" name="correo" required></div>
            <div class="field"><label>Contraseña ${d ? "" : '<span class="req">*</span>'}</label>
                <input class="input" type="password" name="password" minlength="8" ${d ? "" : "required"} autocomplete="new-password">
                <span class="hint">${d ? "Déjela vacía para no cambiarla." : "Mínimo 8 caracteres."}</span></div>
            <div class="field"><label>Rol <span class="req">*</span></label><select class="input" name="rol" required>
                ${opciones(["Administrador", "Recepción", "Dermatólogo"], (x) => x, (x) => x)}</select></div>
            <div class="field" id="campoDerm"><label>Dermatólogo vinculado</label><select class="input" name="id_dermatologo">
                ${opciones(DERMATOLOGOS, "id_dermatologo", (x) => `${x.nombre} ${x.apellido}`, "", "— Ninguno —")}</select>
                <span class="hint">Permite ver solo sus citas al atender.</span></div>
            <div class="field full"><label class="check"><input type="checkbox" name="activo" checked> Usuario activo</label></div>
        </div>`,
    alAbrir: (form) => {
        const ver = () => document.getElementById("campoDerm").style.visibility = form.elements.rol.value === "Dermatólogo" ? "visible" : "hidden";
        form.elements.rol.addEventListener("change", ver);
        ver();
    },
    alGuardar: (d) => { if (!d.password) delete d.password; return d; }
});
