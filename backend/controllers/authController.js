import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { manejarError, requerir, errorHttp } from "../utils/errores.js";

const AuthController = {

    // POST /api/auth/login
    async login(req, res) {
        try {
            requerir(req.body, ["correo", "password"]);
            const correo = String(req.body.correo).trim().toLowerCase();

            const r = await pool.query(
                `SELECT u.*, d.nombre AS derm_nombre, d.apellido AS derm_apellido
                   FROM usuarios u
                   LEFT JOIN dermatologos d ON d.id_dermatologo = u.id_dermatologo
                  WHERE LOWER(u.correo) = $1`,
                [correo]
            );
            const usuario = r.rows[0];

            if (!usuario || !(await bcrypt.compare(req.body.password, usuario.password_hash))) {
                throw errorHttp(401, "Correo o contraseña incorrectos.");
            }
            if (!usuario.activo) {
                throw errorHttp(403, "Su usuario está inactivo. Contacte al administrador.");
            }

            const datos = {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol,
                id_dermatologo: usuario.id_dermatologo
            };

            const token = jwt.sign(datos, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES || "8h"
            });

            await pool.query("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = $1", [usuario.id_usuario]);

            res.json({ mensaje: "Bienvenido(a), " + usuario.nombre, token, usuario: datos });
        } catch (error) {
            manejarError(res, error);
        }
    },

    // GET /api/auth/perfil
    async perfil(req, res) {
        res.json(req.usuario);
    },

    // PUT /api/auth/password
    async cambiarPassword(req, res) {
        try {
            requerir(req.body, ["actual", "nueva"]);
            if (String(req.body.nueva).length < 8) {
                throw errorHttp(400, "La nueva contraseña debe tener al menos 8 caracteres.");
            }
            const r = await pool.query("SELECT password_hash FROM usuarios WHERE id_usuario = $1", [req.usuario.id_usuario]);
            if (!r.rows[0] || !(await bcrypt.compare(req.body.actual, r.rows[0].password_hash))) {
                throw errorHttp(400, "La contraseña actual no es correcta.");
            }
            const hash = await bcrypt.hash(req.body.nueva, 10);
            await pool.query("UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2", [hash, req.usuario.id_usuario]);
            res.json({ mensaje: "Contraseña actualizada correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default AuthController;
