/* Dashboard: indicadores, agenda del día y gráficos */
(async function () {
    const hora = new Date().getHours();
    const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
    document.getElementById("saludo").textContent = `¡${saludo}, ${USUARIO.nombre}!`;

    const accesos = {
        "Administrador": [["📅", "Agendar cita", "citas.html?nueva=1"], ["🩺", "Atender paciente", "atencion.html"], ["👤", "Nuevo paciente", "pacientes.html?nuevo=1"], ["📈", "Generar reporte", "reportes.html"], ["🧾", "Facturación", "facturas.html"], ["💾", "Respaldo de BD", "respaldo.html"]],
        "Recepción": [["📅", "Agendar cita", "citas.html?nueva=1"], ["👤", "Nuevo paciente", "pacientes.html?nuevo=1"], ["🧾", "Facturación", "facturas.html"], ["📈", "Reportes", "reportes.html"]],
        "Dermatólogo": [["🩺", "Atender paciente", "atencion.html"], ["📋", "Historial clínico", "consultas.html"], ["📅", "Mi agenda", "citas.html"], ["👥", "Pacientes", "pacientes.html"]]
    }[USUARIO.rol];
    document.getElementById("accesos").innerHTML = accesos.map(([i, t, u]) => `<a href="${u}"><span>${i}</span>${t}</a>`).join("");

    try {
        const d = await api("/dashboard");
        document.getElementById("fechaHoy").textContent = "Hoy es " + fmt.fechaLarga(d.hoy) + ". Resumen de la jornada, agenda del día y desempeño de la clínica.";
        const k = d.kpi;
        const kpis = [
            ["👥", "Total Pacientes", k.pacientes, `+${k.pacientes_mes} registrados este mes`, "pacientes.html"],
            ["📅", "Citas Hoy", k.citas_hoy, `${k.por_atender_hoy} por atender`, "citas.html"],
            ["🩺", "Atendidas este mes", k.atendidas_mes, `${k.proximas} citas próximas`, USUARIO.rol === "Recepción" ? "citas.html" : "consultas.html"],
            ["💵", "Ingresos del mes", fmt.dineroCorto(k.ingresos_mes), fmt.dinero(k.ingresos_mes), USUARIO.rol === "Dermatólogo" ? "#" : "facturas.html"]
        ];
        document.getElementById("kpis").innerHTML = kpis.map(([i, t, v, s, u]) =>
            `<a class="kpi" href="${u}"><div class="top"><span class="ico">${i}</span>${t}</div><div class="valor">${v}</div><div class="sub">${s}</div></a>`).join("");

        const item = (c, conFecha = false) => `
            <div class="agenda-item">
                <span class="hora">${conFecha ? fmt.fechaTexto(c.fecha).slice(0, 6) + "<br>" : ""}${fmt.hora12(c.hora)}</span>
                <div class="info"><strong>${esc(c.paciente)}</strong><small>${esc(c.servicio)}${c.dermatologo ? " • " + esc(c.dermatologo) : ""}</small></div>
                ${badge(c.estado)}
            </div>`;
        document.getElementById("citasHoy").innerHTML = d.citasHoy.length
            ? d.citasHoy.map((c) => item(c)).join("")
            : `<div class="empty"><span class="big">☕</span>No hay citas programadas para hoy.</div>`;
        document.getElementById("proximas").innerHTML = d.proximas.length
            ? d.proximas.map((c) => item(c, true)).join("")
            : `<div class="empty">Sin citas próximas.</div>`;

        // Gráfico de barras de ingresos
        const max = Math.max(1, ...d.ingresosMeses.map((m) => m.total));
        document.getElementById("graficoIngresos").innerHTML = d.ingresosMeses.map((m) => `
            <div class="bar" title="${fmt.dinero(m.total)}">
                <span class="val">${m.total ? fmt.dineroCorto(m.total) : ""}</span>
                <div class="col" style="height:${(m.total / max) * 100}%"></div>
                <span class="lbl">${fmt.mes(m.mes)}</span>
            </div>`).join("");

        const maxS = Math.max(1, ...d.topServicios.map((s) => s.total));
        document.getElementById("topServicios").innerHTML = d.topServicios.map((s) => `
            <div class="hbar"><div class="row"><span>${esc(s.nombre)}</span><b>${s.total}</b></div>
            <div class="track"><div class="fill" style="width:${(s.total / maxS) * 100}%"></div></div></div>`).join("") || '<div class="empty">Sin datos.</div>';

        const colores = { Atendida: "var(--primary)", Pendiente: "var(--warning)", Confirmada: "var(--info)", Cancelada: "var(--danger)" };
        const totalE = d.porEstado.reduce((s, e) => s + e.total, 0) || 1;
        document.getElementById("porEstado").innerHTML = ["Atendida", "Confirmada", "Pendiente", "Cancelada"].map((e) => {
            const n = (d.porEstado.find((x) => x.estado === e) || { total: 0 }).total;
            return `<div class="hbar"><div class="row"><span>${badge(e)}</span><b>${n} (${Math.round(n / totalE * 100)}%)</b></div>
                    <div class="track"><div class="fill" style="width:${n / totalE * 100}%;background:${colores[e]}"></div></div></div>`;
        }).join("");
    } catch (e) {
        toast(e.message, "error");
    }
})();
