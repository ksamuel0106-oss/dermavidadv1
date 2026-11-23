/* Respaldo (backup) y restauración de la base de datos PostgreSQL */
const NOMBRES = { pacientes: "👥 Pacientes", dermatologos: "👩‍⚕️ Dermatólogos", servicios: "✨ Servicios", usuarios: "🔐 Usuarios", citas: "📅 Citas", consultas: "📋 Consultas", facturas: "🧾 Facturas" };

async function info() {
    try {
        const d = await api("/respaldo/info");
        const total = d.tablas.reduce((s, t) => s + t.registros, 0);
        document.getElementById("infoBD").innerHTML = `<div><small>Base de datos</small><b>${esc(d.base_datos)}</b></div><div><small>Tamaño</small><b>${esc(d.tamano)}</b></div><div><small>Registros</small><b>${total}</b></div>`;
        document.querySelector("#tablaConteo tbody").innerHTML = d.tablas.map((t) => `<tr><td>${NOMBRES[t.tabla] || t.tabla}</td><td class="text-right"><b>${t.registros}</b></td></tr>`).join("");
    } catch (e) { toast(e.message, "error"); }
}

document.getElementById("btnRespaldo").onclick = (e) =>
    conCarga(e.currentTarget, async () => {
        try {
            const nombre = await descargar("/respaldo/descargar", "respaldo.sql");
            toast("Respaldo generado: " + nombre);
        } catch (err) { toast(err.message, "error"); }
    });

const archivo = document.getElementById("archivoSQL");
const conf = document.getElementById("confirmacion");
const btnR = document.getElementById("btnRestaurar");
const validar = () => (btnR.disabled = !(archivo.files.length && conf.value.trim() === "RESTAURAR"));
archivo.addEventListener("change", validar);
conf.addEventListener("input", validar);

btnR.onclick = async (e) => {
    const f = archivo.files[0];
    if (f.size > 20 * 1024 * 1024) return toast("El archivo supera 20 MB.", "error");
    if (!(await confirmar(`Se reemplazarán <b>todos</b> los datos actuales por los del archivo <b>${esc(f.name)}</b>. ¿Continuar?`, { titulo: "Restaurar base de datos", textoOk: "Restaurar" }))) return;
    const sql = await f.text();
    try {
        const r = await conCarga(btnR, () => api("/respaldo/restaurar", { method: "POST", body: { sql, confirmacion: "RESTAURAR" } }));
        toast(r.mensaje);
        setTimeout(() => { Sesion.cerrar(); location.href = "../login.html"; }, 1800);
    } catch (err) { toast(err.message, "error"); }
};

info();
