/*
 * Crea las tablas y carga los datos iniciales (BORRA lo que exista).
 * Uso:  npm run init-db
 * (La base de datos indicada en .env debe existir; si no existe se intenta crear.)
 *
 * Nota: en Render no hace falta ejecutarlo. El servidor crea las tablas y los datos
 * automáticamente la primera vez que arranca con la base de datos vacía.
 */
import pkg from "pg";
import { configConexion } from "../config/conexion.js";
import { cargarEsquemaYDatos } from "./cargar-bd.js";

const { Client } = pkg;

async function crearBaseSiNoExiste() {
    if (process.env.DATABASE_URL) return;
    const admin = new Client(configConexion("postgres"));
    await admin.connect();
    const r = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [process.env.DB_NAME]);
    if (!r.rowCount) {
        await admin.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
        console.log(`Base de datos "${process.env.DB_NAME}" creada.`);
    }
    await admin.end();
}

async function main() {
    await crearBaseSiNoExiste();
    const cliente = new Client(configConexion());
    await cliente.connect();
    console.log("Creando tablas y cargando datos iniciales...");
    const t = await cargarEsquemaYDatos(cliente);
    console.log(`Listo: ${t.p} pacientes, ${t.c} citas, ${t.f} facturas.`);
    console.log("Usuario administrador: admin@dermavida.do  /  Admin123*");
    await cliente.end();
}

main().catch((e) => {
    console.error("Error inicializando la base de datos:", e.message);
    process.exit(1);
});
