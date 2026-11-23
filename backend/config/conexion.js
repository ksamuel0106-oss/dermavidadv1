/*
 * Configuración de conexión a PostgreSQL compartida por el servidor y los scripts.
 *
 * SSL:
 *  - DB_SSL=true  -> fuerza SSL
 *  - DB_SSL=false -> sin SSL
 *  - Sin DB_SSL   -> automático: sin SSL para localhost y para la URL interna de Render
 *                    (host sin puntos, ej. "dpg-xxxx-a"); con SSL para hosts externos
 *                    (Render externo, Neon, Supabase...).
 */
import dotenv from "dotenv";

dotenv.config();

function hostDeUrl(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return "";
    }
}

function decidirSSL(host) {
    if (process.env.DB_SSL === "true") return { rejectUnauthorized: false };
    if (process.env.DB_SSL === "false") return false;
    if (!host || host === "localhost" || host === "127.0.0.1" || !host.includes(".")) return false;
    return { rejectUnauthorized: false };
}

// Zona horaria de las sesiones SQL (CURRENT_DATE, NOW()). En Render la BD trabaja en UTC.
export const ZONA_HORARIA_BD = process.env.DB_TIMEZONE || "America/Santo_Domingo";
const OPCIONES = `-c timezone=${ZONA_HORARIA_BD}`;

export function configConexion(baseDatos) {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: decidirSSL(hostDeUrl(process.env.DATABASE_URL)),
            options: OPCIONES
        };
    }
    return {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: baseDatos || process.env.DB_NAME,
        ssl: decidirSSL(process.env.DB_HOST),
        options: OPCIONES
    };
}
