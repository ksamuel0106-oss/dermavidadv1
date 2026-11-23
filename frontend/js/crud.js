/* =====================================================================
   crud.js — Componente reutilizable para los módulos con
   operaciones CRUD (Crear, Consultar, Actualizar, Eliminar).
   ===================================================================== */

function crearCRUD(cfg) {
    /*
      cfg = {
        ruta: "/pacientes",            // endpoint de la API
        id: "id_paciente",             // llave primaria
        nombre: "paciente",            // texto para mensajes
        columnas: [...],               // columnas de la tabla
        formulario: (dato) => html,    // HTML del formulario
        titulo: (dato) => texto,       // título del modal
        filtrar: (fila, texto) => bool // búsqueda local opcional
        puedeEditar, puedeEliminar     // permisos por rol
        acciones: (fila) => html extra // botones adicionales
        alGuardar: (datos) => datos    // transformar antes de enviar
        tamanoModal: "lg"
      }
    */
    const tbody = document.querySelector("#tabla tbody");
    const info = document.getElementById("infoTabla");
    const buscador = document.getElementById("buscar");
    let registros = [];

    const columnas = [...cfg.columnas];
    if (cfg.puedeEditar || cfg.puedeEliminar || cfg.acciones) {
        columnas.push({
            titulo: "Acciones", clase: "acciones", render: (f) =>
                (cfg.acciones ? cfg.acciones(f) : "") +
                (cfg.puedeEditar ? `<button class="btn-icon" title="Editar" data-editar="${f[cfg.id]}">✏️</button>` : "") +
                (cfg.puedeEliminar ? `<button class="btn-icon danger" title="Eliminar" data-eliminar="${f[cfg.id]}">🗑️</button>` : "")
        });
    }
    document.querySelector("#tabla thead").innerHTML = "<tr>" + columnas.map((c) => `<th class="${c.clase || ""}">${c.titulo}</th>`).join("") + "</tr>";

    function pintar() {
        const texto = (buscador?.value || "").toLowerCase().trim();
        const lista = cfg.filtrar ? registros.filter((r) => cfg.filtrar(r, texto)) : registros;
        tbody.innerHTML = filasTabla(columnas, lista);
        if (info) info.innerHTML = `<span>Mostrando <b>${lista.length}</b> de <b>${registros.length}</b> registros</span>`;
    }

    async function cargar() {
        tbody.innerHTML = `<tr><td colspan="${columnas.length}"><div class="empty"><span class="loader"></span></div></td></tr>`;
        try {
            registros = await api(cfg.ruta + (cfg.query ? cfg.query() : ""));
            pintar();
        } catch (e) {
            toast(e.message, "error");
        }
    }

    async function abrirFormulario(id = null) {
        let dato = null;
        if (id) {
            try { dato = await api(`${cfg.ruta}/${id}`); } catch (e) { return toast(e.message, "error"); }
        }
        const m = abrirModal({
            titulo: cfg.titulo(dato),
            tamano: cfg.tamanoModal || "",
            contenido: `<form id="formCrud" novalidate>${cfg.formulario(dato)}</form>`,
            botones: `<button class="btn btn-light" data-cerrar>Cancelar</button>
                      <button class="btn btn-primary" id="btnGuardarCrud">💾 ${dato ? "Guardar cambios" : "Registrar"}</button>`
        });
        const form = m.el.querySelector("#formCrud");
        if (dato) llenarFormulario(form, dato);
        if (cfg.alAbrir) cfg.alAbrir(form, dato);
        form.addEventListener("submit", (e) => { e.preventDefault(); m.el.querySelector("#btnGuardarCrud").click(); });

        m.el.querySelector("#btnGuardarCrud").onclick = async (e) => {
            if (!form.reportValidity()) return;
            let datos = datosFormulario(form);
            if (cfg.alGuardar) datos = cfg.alGuardar(datos, dato);
            try {
                const r = await conCarga(e.currentTarget, () =>
                    api(dato ? `${cfg.ruta}/${id}` : cfg.ruta, { method: dato ? "PUT" : "POST", body: datos }));
                toast(r.mensaje);
                m.cerrar();
                cargar();
            } catch (err) {
                toast(err.message, "error");
            }
        };
    }

    async function eliminar(id) {
        const fila = registros.find((r) => String(r[cfg.id]) === String(id));
        const etiqueta = cfg.etiqueta ? cfg.etiqueta(fila) : "";
        if (!(await confirmar(`¿Seguro que desea eliminar ${cfg.nombre} <b>${esc(etiqueta)}</b>? Esta acción no se puede deshacer.`, { titulo: "Eliminar " + cfg.nombre, textoOk: "Sí, eliminar" }))) return;
        try {
            const r = await api(`${cfg.ruta}/${id}`, { method: "DELETE" });
            toast(r.mensaje);
            cargar();
        } catch (e) {
            toast(e.message, "error");
        }
    }

    tbody.addEventListener("click", (e) => {
        const ed = e.target.closest("[data-editar]");
        const el = e.target.closest("[data-eliminar]");
        if (ed) abrirFormulario(ed.dataset.editar);
        if (el) eliminar(el.dataset.eliminar);
    });
    buscador?.addEventListener("input", cfg.busquedaServidor ? debounce(cargar, 350) : pintar);
    document.getElementById("btnNuevo")?.addEventListener("click", () => abrirFormulario());

    cargar();
    return { cargar, pintar, abrirFormulario, registros: () => registros };
}

/* Opciones <option> a partir de una lista */
function opciones(lista, valor, texto, seleccionado = "", vacio = "Seleccione...") {
    return (vacio ? `<option value="">${vacio}</option>` : "") +
        lista.map((x) => {
            const v = typeof valor === "function" ? valor(x) : x[valor] ?? x;
            const t = typeof texto === "function" ? texto(x) : x[texto] ?? x;
            return `<option value="${esc(v)}" ${String(v) === String(seleccionado) ? "selected" : ""}>${esc(t)}</option>`;
        }).join("");
}
