/*
 * =====================================================================
 *  CLÍNICA DERMATOLÓGICA DERMAVIDA - SERVIDOR PRINCIPAL
 *  Laboratorio de Programación III - UCATECI
 *  Node.js + Express + PostgreSQL + JWT
 * =====================================================================
 */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
process.env.TZ = process.env.TZ || "America/Santo_Domingo";

import pool, { probarConexion } from "./config/db.js";
import { inicializarSiVacia } from "./scripts/cargar-bd.js";
import authRoutes from "./routes/auth.js";
import pacientesRoutes from "./routes/pacientes.js";
import dermatologosRoutes from "./routes/dermatologos.js";
import serviciosRoutes from "./routes/servicios.js";
import usuariosRoutes from "./routes/usuarios.js";
import citasRoutes from "./routes/citas.js";
import consultasRoutes from "./routes/consultas.js";
import facturasRoutes from "./routes/facturas.js";
import reportesRoutes from "./routes/reportes.js";
import respaldoRoutes from "./routes/respaldo.js";
import dashboardRoutes from "./routes/dashboard.js";
import publicoRoutes from "./routes/publico.js";

if (!process.env.JWT_SECRET) {
    console.error("Falta la variable JWT_SECRET en el archivo .env");
    process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

/* ---------------- MIDDLEWARES ---------------- */
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- API ---------------- */
app.get("/api", (req, res) => {
    res.json({ sistema: "Clínica Dermatológica DermaVida", version: "1.0", estado: "Servidor funcionando" });
});

// Verificación de salud para Render
app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({ estado: "ok" });
    } catch {
        res.status(503).json({ estado: "sin conexión a la base de datos" });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/publico", publicoRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/pacientes", pacientesRoutes);
app.use("/api/dermatologos", dermatologosRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/citas", citasRoutes);
app.use("/api/consultas", consultasRoutes);
app.use("/api/facturas", facturasRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/respaldo", respaldoRoutes);

app.use("/api", (req, res) => res.status(404).json({ mensaje: "Ruta de API no encontrada" }));

/* ---------------- FRONTEND (HTML, CSS, JS) ---------------- */
const FRONTEND = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND, { extensions: ["html"] }));
app.use((req, res) => {
    // Archivos inexistentes (imágenes, css...) -> 404 simple; rutas desconocidas -> página principal
    if (path.extname(req.path)) return res.status(404).end();
    res.redirect("/");
});

/* ---------------- SERVIDOR ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log("==========================================");
    console.log("  CLÍNICA DERMATOLÓGICA DERMAVIDA");
    console.log("==========================================");
    console.log("  Servidor: http://localhost:" + PORT);
    try {
        const info = await probarConexion();
        console.log("  PostgreSQL conectado a la BD: " + info.bd);
        const carga = await inicializarSiVacia(pool);
        if (carga) {
            console.log(`  BD vacía: tablas y datos creados (${carga.p} pacientes, ${carga.c} citas, ${carga.f} facturas).`);
        }
    } catch (error) {
        console.log("  ERROR al conectar con PostgreSQL: " + error.message);
        console.log("  Revise el archivo .env y que la base de datos exista.");
    }
    console.log("==========================================");
});
