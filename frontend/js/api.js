/* =====================================================================
   api.js — Conexión con el servidor, manejo del token JWT y utilidades
   ===================================================================== */

// Si el frontend se sirve desde el mismo servidor Express, basta con "/api".
// Si se abre por separado (ej. Live Server), apunta al puerto 3000.
const API_URL = location.port === "3000" || location.protocol.startsWith("http") && !["5500", "5501"].includes(location.port)
    ? "/api"
    : "http://localhost:3000/api";

const Sesion = {
    guardar(token, usuario, recordar) {
        const almacen = recordar ? localStorage : sessionStorage;
        almacen.setItem("dv_token", token);
        almacen.setItem("dv_usuario", JSON.stringify(usuario));
    },
    token() {
        return localStorage.getItem("dv_token") || sessionStorage.getItem("dv_token");
    },
    usuario() {
        try {
            return JSON.parse(localStorage.getItem("dv_usuario") || sessionStorage.getItem("dv_usuario"));
        } catch { return null; }
    },
    cerrar() {
        ["dv_token", "dv_usuario"].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    },
    // Revisa que el token no esté vencido (lee el "exp" del JWT)
    vigente() {
        const t = this.token();
        if (!t) return false;
        try {
            const datos = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
            return datos.exp * 1000 > Date.now();
        } catch { return false; }
    }
};

/* Petición genérica a la API con el token en el encabezado Authorization */
async function api(ruta, { method = "GET", body = null } = {}) {
    const opciones = { method, headers: {} };
    const token = Sesion.token();
    if (token) opciones.headers.Authorization = "Bearer " + token;
    if (body !== null) {
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(body);
    }

    let respuesta;
    try {
        respuesta = await fetch(API_URL + ruta, opciones);
    } catch {
        throw new Error("No se pudo conectar con el servidor. Verifique que esté encendido.");
    }

    if (respuesta.status === 401 && !ruta.startsWith("/auth/login")) {
        Sesion.cerrar();
        location.href = rutaRaiz() + "login.html?expirada=1";
        throw new Error("Sesión expirada");
    }

    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.mensaje || "Error " + respuesta.status);
    return datos;
}

/* Descarga de archivos protegidos (PDF, Excel, respaldo) */
async function descargar(ruta, nombrePorDefecto = "archivo") {
    const respuesta = await fetch(API_URL + ruta, { headers: { Authorization: "Bearer " + Sesion.token() } });
    if (!respuesta.ok) {
        const e = await respuesta.json().catch(() => ({}));
        throw new Error(e.mensaje || "No se pudo descargar el archivo.");
    }
    const disp = respuesta.headers.get("Content-Disposition") || "";
    const nombre = (disp.match(/filename="?([^"]+)"?/) || [])[1] || nombrePorDefecto;
    const blob = await respuesta.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return nombre;
}

function rutaRaiz() {
    return location.pathname.includes("/app/") ? "../" : "";
}

/* ------------------------- FORMATOS ------------------------- */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const fmt = {
    dinero: (n) => "RD$ " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    dineroCorto: (n) => {
        n = Number(n || 0);
        if (n >= 1e6) return "RD$ " + (n / 1e6).toFixed(1) + "M";
        if (n >= 1e3) return "RD$ " + Math.round(n / 1e3) + "K";
        return "RD$ " + n.toFixed(0);
    },
    fecha: (f) => {
        if (!f) return "—";
        const [a, m, d] = String(f).slice(0, 10).split("-");
        return `${d}/${m}/${a}`;
    },
    fechaTexto: (f) => {
        if (!f) return "—";
        const [a, m, d] = String(f).slice(0, 10).split("-").map(Number);
        return `${d} ${MESES[m - 1]} ${a}`;
    },
    fechaLarga: (f) => {
        const [a, m, d] = String(f).slice(0, 10).split("-").map(Number);
        const dia = new Date(a, m - 1, d).getDay();
        return `${DIAS[dia]}, ${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
    },
    hora12: (h) => {
        if (!h) return "";
        let [hh, mm] = h.split(":").map(Number);
        const ap = hh >= 12 ? "PM" : "AM";
        hh = hh % 12 || 12;
        return `${hh}:${String(mm).padStart(2, "0")} ${ap}`;
    },
    iniciales: (nombre = "") => nombre.replace(/^(Dra?\.)\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase(),
    mes: (ym) => { const [a, m] = ym.split("-").map(Number); return MESES[m - 1] + " " + String(a).slice(2); }
};

function hoyISO(desplazarDias = 0) {
    const d = new Date();
    d.setDate(d.getDate() + desplazarDias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Escapa texto para insertarlo de forma segura en HTML */
function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function badge(estado) {
    return `<span class="badge ${String(estado).toLowerCase()}">${esc(estado)}</span>`;
}

function debounce(fn, ms = 300) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ------------------------- NOTIFICACIONES ------------------------- */
function toast(mensaje, tipo = "ok") {
    let cont = document.querySelector(".toasts");
    if (!cont) {
        cont = document.createElement("div");
        cont.className = "toasts";
        document.body.appendChild(cont);
    }
    const icono = { ok: "✅", error: "⚠️", warn: "🔔" }[tipo] || "ℹ️";
    const el = document.createElement("div");
    el.className = "toast " + tipo;
    el.innerHTML = `<span>${icono}</span><div>${esc(mensaje)}</div>`;
    cont.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, 4200);
    setTimeout(() => el.remove(), 4600);
}

/* ------------------------- MODALES ------------------------- */
function abrirModal({ titulo, contenido, tamano = "", botones = "" }) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal ${tamano}" role="dialog" aria-modal="true">
            <div class="modal-head"><h3>${titulo}</h3><button class="cerrar" type="button" aria-label="Cerrar">×</button></div>
            <div class="modal-body">${contenido}</div>
            ${botones ? `<div class="modal-foot">${botones}</div>` : ""}
        </div>`;
    const cerrar = () => { overlay.remove(); document.removeEventListener("keydown", esc_); };
    const esc_ = (e) => { if (e.key === "Escape") cerrar(); };
    overlay.querySelector(".cerrar").onclick = cerrar;
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) cerrar(); });
    overlay.querySelectorAll("[data-cerrar]").forEach((b) => (b.onclick = cerrar));
    document.addEventListener("keydown", esc_);
    document.body.appendChild(overlay);
    const primero = overlay.querySelector("input:not([type=hidden]), select, textarea");
    if (primero) setTimeout(() => primero.focus(), 50);
    return { el: overlay, cerrar };
}

function confirmar(mensaje, { titulo = "Confirmar acción", textoOk = "Sí, continuar", peligro = true } = {}) {
    return new Promise((resolve) => {
        const m = abrirModal({
            titulo,
            tamano: "sm",
            contenido: `<p class="mb-0">${mensaje}</p>`,
            botones: `<button class="btn btn-light" data-cerrar>Cancelar</button>
                      <button class="btn ${peligro ? "btn-danger" : "btn-primary"}" id="btnOkConfirmar">${textoOk}</button>`
        });
        m.el.querySelectorAll("[data-cerrar], .cerrar").forEach((b) => b.addEventListener("click", () => resolve(false)));
        m.el.querySelector("#btnOkConfirmar").onclick = () => { m.cerrar(); resolve(true); };
    });
}

/* Convierte un formulario en objeto */
function datosFormulario(form) {
    const datos = {};
    new FormData(form).forEach((v, k) => (datos[k] = typeof v === "string" ? v.trim() : v));
    form.querySelectorAll("input[type=checkbox][name]").forEach((c) => (datos[c.name] = c.checked));
    return datos;
}

function llenarFormulario(form, datos) {
    Object.entries(datos).forEach(([k, v]) => {
        const campo = form.elements[k];
        if (!campo) return;
        if (campo.type === "checkbox") campo.checked = !!v;
        else if (campo.type === "time" && v) campo.value = String(v).slice(0, 5);
        else campo.value = v ?? "";
    });
}

/* Ejecuta una acción mostrando estado de carga en el botón */
async function conCarga(boton, accion) {
    const texto = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<span class="loader"></span> Procesando...';
    try { return await accion(); } finally { boton.disabled = false; boton.innerHTML = texto; }
}

/* Genera filas de tabla con data-label (para vista móvil tipo tarjeta) */
function filasTabla(columnas, filas, vacio = "No hay registros para mostrar.") {
    if (!filas.length) {
        return `<tr><td colspan="${columnas.length}"><div class="empty"><span class="big">🗂️</span>${vacio}</div></td></tr>`;
    }
    return filas.map((f) => "<tr>" + columnas.map((c) =>
        `<td data-label="${esc(c.titulo)}" class="${c.clase || ""}">${c.render ? c.render(f) : esc(f[c.clave])}</td>`
    ).join("") + "</tr>").join("");
}
