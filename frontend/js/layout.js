/* =====================================================================
   layout.js — Construye el menú lateral y el encabezado (como el
   DashboardWindow del Consultorio) y protege las páginas con JWT.
   Cada página declara en <body>:
     data-pagina="pacientes"  data-titulo="Pacientes"  data-roles="Administrador,Recepción"
   ===================================================================== */

const MENU = [
    
    { id: "dashboard", texto: "Dashboard", icono: "📊", url: "dashboard.html", roles: ["Administrador", "Recepción", "Dermatólogo"] },
    { id: "citas", texto: "Agenda de Citas", icono: "📅", url: "citas.html", roles: ["Administrador", "Recepción", "Dermatólogo"] },
    { id: "atencion", texto: "Atención y Cobro", icono: "🩺", url: "atencion.html", roles: ["Administrador", "Dermatólogo"] },
    { id: "pacientes", texto: "Pacientes", icono: "👥", url: "pacientes.html", roles: ["Administrador", "Recepción", "Dermatólogo"] },
    { id: "consultas", texto: "Historial Clínico", icono: "📋", url: "consultas.html", roles: ["Administrador", "Dermatólogo"] },
    { id: "facturas", texto: "Facturación", icono: "🧾", url: "facturas.html", roles: ["Administrador", "Recepción"] },
    { grupo: "Catálogos" },
    { id: "dermatologos", texto: "Dermatólogos", icono: "👩‍⚕️", url: "dermatologos.html", roles: ["Administrador", "Recepción", "Dermatólogo"] },
    { id: "servicios", texto: "Servicios", icono: "✨", url: "servicios.html", roles: ["Administrador", "Recepción", "Dermatólogo"] },
    { grupo: "Administración" },
    { id: "reportes", texto: "Reportes", icono: "📈", url: "reportes.html", roles: ["Administrador", "Recepción"] },
    { id: "usuarios", texto: "Usuarios", icono: "🔐", url: "usuarios.html", roles: ["Administrador"] },
    { id: "respaldo", texto: "Respaldo de BD", icono: "💾", url: "respaldo.html", roles: ["Administrador"] }
];

const USUARIO = (() => {
    // 1. Protección: sin token válido no se entra al sistema
    if (!Sesion.vigente()) {
        Sesion.cerrar();
        location.replace("../login.html?expirada=1");
        throw new Error("Sin sesión");
    }
    const u = Sesion.usuario();
    const roles = (document.body.dataset.roles || "").split(",").map((r) => r.trim()).filter(Boolean);
    if (roles.length && !roles.includes(u.rol)) {
        location.replace("dashboard.html");
        throw new Error("Sin permiso");
    }
    return u;
})();

function construirLayout() {
    const pagina = document.body.dataset.pagina;
    const titulo = document.body.dataset.titulo || document.title;
    const contenido = document.querySelector("main");
    contenido.classList.add("content");

    // Filtrar el menú según el rol (ocultando grupos vacíos)
    const items = [];
    MENU.forEach((m, i) => {
        if (m.grupo) {
            const siguiente = MENU.slice(i + 1);
            const fin = siguiente.findIndex((x) => x.grupo);
            const delGrupo = (fin === -1 ? siguiente : siguiente.slice(0, fin)).filter((x) => x.roles.includes(USUARIO.rol));
            if (delGrupo.length) items.push(`<div class="grupo">${m.grupo}</div>`);
        } else if (m.roles.includes(USUARIO.rol)) {
            items.push(`<a href="${m.url}" class="${m.id === pagina ? "active" : ""}"><span class="ico">${m.icono}</span>${m.texto}</a>`);
        }
    });

    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    sidebar.innerHTML = `
        <a class="logo-box" href="dashboard.html">
            <img src="../img/logo.svg" alt="Logo DermaVida">
            <div><strong>DERMAVIDA</strong><small>Gestión Dermatológica</small></div>
        </a>
        <div class="divider"></div>
        <div class="menu-label">MENÚ PRINCIPAL</div>
        <nav>${items.join("")}</nav>
        <div class="side-footer">
            <button class="btn btn-danger btn-block" id="btnSalir">🚪 Cerrar sesión</button>
        </div>`;

    const main = document.createElement("div");
    main.className = "main";
    main.innerHTML = `
        <header class="topbar">
            <div class="left">
                <button class="btn-icon menu-toggle" id="btnMenu" aria-label="Abrir menú">☰</button>
                <h1>${titulo}</h1>
            </div>
            <div class="right">
                <span class="online">● Sistema En Línea</span>
                <span class="sep"></span>
                <div class="dropdown" id="menuUsuario">
                    <button class="user-chip" type="button">
                        <span class="avatar">${fmt.iniciales(USUARIO.nombre)}</span>
                        <span class="who"><strong>${esc(USUARIO.nombre)}</strong><small>${esc(USUARIO.rol)}</small></span>
                    </button>
                    <div class="dropdown-menu">
                        <button type="button" id="btnClave">🔑 Cambiar contraseña</button>
                        <button type="button" onclick="location.href='../index.html'">🌐 Ver sitio público</button>
                        <button type="button" id="btnSalir2">🚪 Cerrar sesión</button>
                    </div>
                </div>
            </div>
        </header>`;

    document.body.classList.add("app-body");
    document.body.prepend(sidebar);
    sidebar.after(main);
    main.appendChild(contenido);
    const fondo = document.createElement("div");
    fondo.className = "backdrop";
    document.body.appendChild(fondo);

    // Eventos
    const salir = async () => {
        if (await confirmar("¿Desea cerrar la sesión actual?", { titulo: "Cerrar sesión", textoOk: "Cerrar sesión" })) {
            Sesion.cerrar();
            location.href = "../login.html";
        }
    };
    document.getElementById("btnSalir").onclick = salir;
    document.getElementById("btnSalir2").onclick = salir;
    document.getElementById("btnMenu").onclick = () => document.body.classList.toggle("menu-open");
    fondo.onclick = () => document.body.classList.remove("menu-open");
    const dd = document.getElementById("menuUsuario");
    dd.querySelector(".user-chip").onclick = (e) => { e.stopPropagation(); dd.classList.toggle("open"); };
    document.addEventListener("click", () => dd.classList.remove("open"));
    document.getElementById("btnClave").onclick = cambiarClave;
}

function cambiarClave() {
    const m = abrirModal({
        titulo: "🔑 Cambiar contraseña",
        tamano: "sm",
        contenido: `
            <form id="formClave" class="stack">
                <div class="field"><label>Contraseña actual</label><input class="input" type="password" name="actual" required></div>
                <div class="field"><label>Nueva contraseña</label><input class="input" type="password" name="nueva" minlength="8" required>
                    <span class="hint">Mínimo 8 caracteres.</span></div>
                <div class="field"><label>Confirmar nueva contraseña</label><input class="input" type="password" name="confirmar" required></div>
            </form>`,
        botones: `<button class="btn btn-light" data-cerrar>Cancelar</button><button class="btn btn-primary" id="btnGuardarClave">Guardar</button>`
    });
    m.el.querySelector("#btnGuardarClave").onclick = async (e) => {
        const f = m.el.querySelector("#formClave");
        if (!f.reportValidity()) return;
        const d = datosFormulario(f);
        if (d.nueva !== d.confirmar) return toast("Las contraseñas no coinciden.", "error");
        try {
            const r = await conCarga(e.currentTarget, () => api("/auth/password", { method: "PUT", body: d }));
            toast(r.mensaje);
            m.cerrar();
        } catch (err) { toast(err.message, "error"); }
    };
}

construirLayout();
