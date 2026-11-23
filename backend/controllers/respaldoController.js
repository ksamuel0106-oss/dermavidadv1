/*
 * Respaldo (backup) y restauración de la base de datos.
 * Genera un script .sql con la estructura y todos los datos,
 * sin depender de pg_dump (funciona igual en Windows, Linux o en la nube).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";
import { manejarError, errorHttp } from "../utils/errores.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_ESQUEMA = path.join(__dirname, "..", "..", "database", "schema.sql");

// Orden respetando las llaves foráneas
const TABLAS = [
    { nombre: "pacientes", id: "id_paciente" },
    { nombre: "dermatologos", id: "id_dermatologo" },
    { nombre: "servicios", id: "id_servicio" },
    { nombre: "usuarios", id: "id_usuario" },
    { nombre: "citas", id: "id_cita" },
    { nombre: "consultas", id: "id_consulta" },
    { nombre: "facturas", id: "id_factura" }
];

function valorSQL(v) {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (v instanceof Date) return "'" + v.toISOString() + "'";
    return "'" + String(v).replace(/'/g, "''") + "'";
}

const RespaldoController = {

    // GET /api/respaldo/info
    async info(req, res) {
        try {
            const conteos = await Promise.all(TABLAS.map(async (t) => {
                const r = await pool.query(`SELECT COUNT(*) AS n FROM ${t.nombre}`);
                return { tabla: t.nombre, registros: r.rows[0].n };
            }));
            const tam = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS tam, current_database() AS bd");
            res.json({ base_datos: tam.rows[0].bd, tamano: tam.rows[0].tam, tablas: conteos });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // GET /api/respaldo/descargar
    async descargar(req, res) {
        try {
            const ahora = new Date();
            const z = (n) => String(n).padStart(2, "0");
            const sello = `${ahora.getFullYear()}${z(ahora.getMonth() + 1)}${z(ahora.getDate())}_${z(ahora.getHours())}${z(ahora.getMinutes())}`;

            let sql = `-- =====================================================================\n`
                + `--  RESPALDO - CLÍNICA DERMATOLÓGICA DERMAVIDA\n`
                + `--  Generado: ${ahora.toLocaleString("es-DO")} por ${req.usuario.nombre}\n`
                + `--  Restaurar: psql -U postgres -d clinica_dermatologica -f este_archivo.sql\n`
                + `--  o desde el módulo "Respaldo" del sistema.\n`
                + `-- =====================================================================\n\n`;

            sql += fs.readFileSync(RUTA_ESQUEMA, "utf8") + "\n\n-- ======================= DATOS =======================\n\n";

            for (const t of TABLAS) {
                const r = await pool.query(`SELECT * FROM ${t.nombre} ORDER BY ${t.id}`);
                sql += `-- ${t.nombre.toUpperCase()} (${r.rows.length} registros)\n`;
                if (r.rows.length) {
                    const columnas = Object.keys(r.rows[0]);
                    const lote = 200;
                    for (let i = 0; i < r.rows.length; i += lote) {
                        sql += `INSERT INTO ${t.nombre} (${columnas.join(", ")}) VALUES\n`;
                        sql += r.rows.slice(i, i + lote)
                            .map((f) => "(" + columnas.map((c) => valorSQL(f[c])).join(", ") + ")")
                            .join(",\n") + ";\n";
                    }
                }
                sql += `SELECT setval(pg_get_serial_sequence('${t.nombre}', '${t.id}'), COALESCE((SELECT MAX(${t.id}) FROM ${t.nombre}), 0) + 1, false);\n\n`;
            }

            res.setHeader("Content-Type", "application/sql; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="respaldo_dermavida_${sello}.sql"`);
            res.send(sql);
        } catch (error) {
            manejarError(res, error);
        }
    },

    // POST /api/respaldo/restaurar  { sql, confirmacion: "RESTAURAR" }
    async restaurar(req, res) {
        const cliente = await pool.connect();
        try {
            if (req.body.confirmacion !== "RESTAURAR") throw errorHttp(400, "Debe escribir RESTAURAR para confirmar.");
            const sql = String(req.body.sql || "");
            if (!sql.includes("CREATE TABLE pacientes") || !sql.includes("INSERT INTO usuarios")) {
                throw errorHttp(400, "El archivo no parece un respaldo válido de DermaVida.");
            }
            await cliente.query("BEGIN");
            await cliente.query(sql);
            await cliente.query("COMMIT");
            res.json({ mensaje: "Base de datos restaurada correctamente. Inicie sesión nuevamente." });
        } catch (error) {
            await cliente.query("ROLLBACK");
            if (!error.status) error = errorHttp(400, "No se pudo restaurar (no se modificó nada): " + error.message);
            manejarError(res, error);
        } finally {
            cliente.release();
        }
    }
};

export default RespaldoController;
