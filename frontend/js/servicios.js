/* Módulo Servicios — CRUD del catálogo de procedimientos */
const esAdmin = USUARIO.rol === "Administrador";
if (!esAdmin) document.getElementById("btnNuevo").remove();
const ICONOS = { "Clínica": "🩺", "Diagnóstica": "🔍", "Quirúrgica": "✂️", "Estética": "✨" };

const crudServicios = crearCRUD({
    ruta: "/servicios",
    id: "id_servicio",
    nombre: "el servicio",
    puedeEditar: esAdmin,
    puedeEliminar: esAdmin,
    etiqueta: (f) => f.nombre,
    filtrar: (f, t) => f.nombre.toLowerCase().includes(t) && (!document.getElementById("filtroCategoria").value || f.categoria === document.getElementById("filtroCategoria").value),
    columnas: [
        { titulo: "Servicio", render: (f) => `<strong>${esc(f.nombre)}</strong><small>${esc(f.descripcion || "")}</small>` },
        { titulo: "Categoría", render: (f) => `<span class="chip">${ICONOS[f.categoria]} ${esc(f.categoria)}</span>` },
        { titulo: "Duración", render: (f) => `${f.duracion_min} min` },
        { titulo: "Precio", clase: "text-right", render: (f) => `<b>${fmt.dinero(f.precio)}</b>` },
        { titulo: "Solicitado", render: (f) => `${f.veces_solicitado} veces` },
        { titulo: "Estado", render: (f) => badge(f.activo ? "Activo" : "Inactivo") }
    ],
    titulo: (d) => d ? "✏️ Editar servicio" : "➕ Nuevo servicio",
    formulario: () => `
        <div class="form-grid">
            <div class="field full"><label>Nombre del servicio <span class="req">*</span></label><input class="input" name="nombre" required maxlength="100"></div>
            <div class="field"><label>Categoría <span class="req">*</span></label><select class="input" name="categoria" required>${opciones(Object.keys(ICONOS), (x) => x, (x) => ICONOS[x] + " " + x)}</select></div>
            <div class="field"><label>Precio (RD$) <span class="req">*</span></label><input class="input" type="number" name="precio" min="0" step="50" required></div>
            <div class="field"><label>Duración (minutos) <span class="req">*</span></label><input class="input" type="number" name="duracion_min" min="10" max="240" step="5" value="30" required></div>
            <div class="field" style="justify-content:flex-end"><label class="check"><input type="checkbox" name="activo" checked> Disponible</label></div>
            <div class="field full"><label>Descripción</label><textarea class="input" name="descripcion" maxlength="300"></textarea></div>
        </div>`
});

// Filtro por categoría
document.getElementById("filtroCategoria").addEventListener("change", () => crudServicios.pintar());
