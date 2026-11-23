/*
 * Convierte los errores de PostgreSQL en mensajes claros para el usuario.
 */
export function manejarError(res, error) {
    if (error.status) {
        return res.status(error.status).json({ mensaje: error.message });
    }

    switch (error.code) {
        case "23505":
            return res.status(409).json({ mensaje: "Ya existe un registro con ese valor único (" + (error.constraint || "dato duplicado") + ")." });
        case "23503":
            return res.status(409).json({ mensaje: "No se puede completar: el registro tiene información relacionada (citas, consultas o facturas)." });
        case "23514":
            return res.status(400).json({ mensaje: "Algún dato no cumple las reglas de validación (" + (error.constraint || "check") + ")." });
        case "22P02":
        case "22007":
        case "22008":
            return res.status(400).json({ mensaje: "Formato de dato inválido." });
        default:
            console.error(error);
            return res.status(500).json({ mensaje: "Error interno del servidor: " + error.message });
    }
}

/* Lanza un error controlado con su código HTTP */
export function errorHttp(status, mensaje) {
    const e = new Error(mensaje);
    e.status = status;
    return e;
}

/* Verifica que los campos obligatorios existan */
export function requerir(objeto, campos) {
    const faltantes = campos.filter((c) => objeto[c] === undefined || objeto[c] === null || String(objeto[c]).trim() === "");
    if (faltantes.length) {
        throw errorHttp(400, "Campos obligatorios faltantes: " + faltantes.join(", "));
    }
}

/* Fecha de hoy en formato YYYY-MM-DD según la zona horaria del servidor */
export function hoyISO() {
    const d = new Date();
    const z = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/* Convierte 'HH:MM' o 'HH:MM:SS' a minutos */
export function aMinutos(hora) {
    const [h, m] = String(hora).split(":").map(Number);
    return h * 60 + m;
}

/* Convierte minutos a 'HH:MM' */
export function aHora(minutos) {
    const z = (n) => String(n).padStart(2, "0");
    return `${z(Math.floor(minutos / 60))}:${z(minutos % 60)}`;
}
