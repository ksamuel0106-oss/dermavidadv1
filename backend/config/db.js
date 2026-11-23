import pkg from "pg";
import { configConexion } from "./conexion.js";

const { Pool, types } = pkg;

// Devolver DATE como texto 'YYYY-MM-DD' (evita desfases por zona horaria)
types.setTypeParser(1082, (valor) => valor);
// Devolver NUMERIC como número
types.setTypeParser(1700, (valor) => parseFloat(valor));
// Devolver TIMESTAMP como texto 'YYYY-MM-DD HH:MM:SS' (sin conversión de zona)
types.setTypeParser(1114, (valor) => valor);
// Devolver COUNT/BIGINT como número
types.setTypeParser(20, (valor) => parseInt(valor, 10));

const pool = new Pool(configConexion());

export async function probarConexion() {
    const cliente = await pool.connect();
    try {
        const r = await cliente.query("SELECT current_database() AS bd, version() AS version");
        return r.rows[0];
    } finally {
        cliente.release();
    }
}

export default pool;
