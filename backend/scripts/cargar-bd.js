/*
 * Carga de la estructura (schema.sql) y los datos iniciales (seed.sql).
 * Lo usan "npm run init-db" (recarga completa) y el servidor al arrancar
 * (solo si la base de datos está vacía).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ZONA_HORARIA_BD } from "../config/conexion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR_BD = path.join(__dirname, "..", "..", "database");

export async function tablasExisten(cliente) {
    const r = await cliente.query("SELECT to_regclass('public.usuarios') IS NOT NULL AS existe");
    return r.rows[0].existe;
}

export async function cargarEsquemaYDatos(cliente) {
    await cliente.query(`SET TIME ZONE '${ZONA_HORARIA_BD}'`);
    await cliente.query("BEGIN");
    try {
        await cliente.query(fs.readFileSync(path.join(DIR_BD, "schema.sql"), "utf8"));
        await cliente.query(fs.readFileSync(path.join(DIR_BD, "seed.sql"), "utf8"));
        await cliente.query("COMMIT");
    } catch (error) {
        await cliente.query("ROLLBACK");
        throw error;
    }
    const r = await cliente.query(`SELECT (SELECT COUNT(*) FROM pacientes) p, (SELECT COUNT(*) FROM citas) c, (SELECT COUNT(*) FROM facturas) f`);
    return r.rows[0];
}

// Crea tablas y datos solo si la base está vacía. Nunca borra datos existentes.
export async function inicializarSiVacia(pool) {
    const cliente = await pool.connect();
    try {
        if (await tablasExisten(cliente)) return null;
        // Bloqueo para que dos instancias no inicialicen a la vez
        await cliente.query("SELECT pg_advisory_lock(84021)");
        try {
            if (await tablasExisten(cliente)) return null;
            return await cargarEsquemaYDatos(cliente);
        } finally {
            await cliente.query("SELECT pg_advisory_unlock(84021)");
        }
    } finally {
        cliente.release();
    }
}
