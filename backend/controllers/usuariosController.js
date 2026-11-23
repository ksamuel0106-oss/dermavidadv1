import bcrypt from "bcryptjs";
import pool from "../config/db.js";
import { manejarError, requerir, errorHttp } from "../utils/errores.js";

const SELECT = `SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.id_dermatologo, u.activo,
                       u.ultimo_acceso, u.creado_en,
                       d.nombre || ' ' || d.apellido AS dermatologo
                  FROM usuarios u
                  LEFT JOIN dermatologos d ON d.id_dermatologo = u.id_dermatologo`;

const UsuariosController = {

    async listar(req, res) {
        try {
            const r = await pool.query(SELECT + " ORDER BY u.rol, u.nombre");
            res.json(r.rows);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async buscar(req, res) {
        try {
            const r = await pool.query(SELECT + " WHERE u.id_usuario = $1", [req.params.id]);
            if (!r.rows[0]) throw errorHttp(404, "Usuario no encontrado.");
            res.json(r.rows[0]);
        } catch (error) {
            manejarError(res, error);
        }
    },

    async crear(req, res) {
        try {
            requerir(req.body, ["nombre", "correo", "password", "rol"]);
            if (String(req.body.password).length < 8) throw errorHttp(400, "La contraseña debe tener al menos 8 caracteres.");
            const hash = await bcrypt.hash(req.body.password, 10);
            const r = await pool.query(
                `INSERT INTO usuarios (nombre, correo, password_hash, rol, id_dermatologo, activo)
                 VALUES ($1, LOWER($2), $3, $4, $5, $6) RETURNING id_usuario`,
                [req.body.nombre.trim(), req.body.correo.trim(), hash, req.body.rol,
                 req.body.rol === "Dermatólogo" && req.body.id_dermatologo ? req.body.id_dermatologo : null,
                 !(req.body.activo === false || req.body.activo === "false")]
            );
            res.status(201).json({ mensaje: "Usuario creado correctamente.", datos: r.rows[0] });
        } catch (error) {
            manejarError(res, error);
        }
    },

    async actualizar(req, res) {
        try {
            requerir(req.body, ["nombre", "correo", "rol"]);
            const activo = !(req.body.activo === false || req.body.activo === "false");
            if (Number(req.params.id) === req.usuario.id_usuario && (!activo || req.body.rol !== "Administrador")) {
                throw errorHttp(400, "No puede desactivarse ni quitarse el rol de administrador a sí mismo.");
            }
            const valores = [req.body.nombre.trim(), req.body.correo.trim(), req.body.rol,
                req.body.rol === "Dermatólogo" && req.body.id_dermatologo ? req.body.id_dermatologo : null,
                activo, req.params.id];
            let sql = `UPDATE usuarios SET nombre=$1, correo=LOWER($2), rol=$3, id_dermatologo=$4, activo=$5`;
            if (req.body.password) {
                if (String(req.body.password).length < 8) throw errorHttp(400, "La contraseña debe tener al menos 8 caracteres.");
                valores.push(await bcrypt.hash(req.body.password, 10));
                sql += `, password_hash=$7`;
            }
            const r = await pool.query(sql + " WHERE id_usuario=$6 RETURNING id_usuario", valores);
            if (!r.rows[0]) throw errorHttp(404, "Usuario no encontrado.");
            res.json({ mensaje: "Usuario actualizado correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    },

    async eliminar(req, res) {
        try {
            if (Number(req.params.id) === req.usuario.id_usuario) {
                throw errorHttp(400, "No puede eliminar su propio usuario.");
            }
            const r = await pool.query("DELETE FROM usuarios WHERE id_usuario = $1", [req.params.id]);
            if (!r.rowCount) throw errorHttp(404, "Usuario no encontrado.");
            res.json({ mensaje: "Usuario eliminado correctamente." });
        } catch (error) {
            manejarError(res, error);
        }
    }
};

export default UsuariosController;
