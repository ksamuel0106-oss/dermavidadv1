import express from "express";
import UsuariosController from "../controllers/usuariosController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(verificarToken);

// Consultar
router.get("/", permitirRoles("Administrador"), UsuariosController.listar);
router.get("/:id", permitirRoles("Administrador"), UsuariosController.buscar);

// Crear
router.post("/", permitirRoles("Administrador"), UsuariosController.crear);

// Actualizar
router.put("/:id", permitirRoles("Administrador"), UsuariosController.actualizar);

// Eliminar
router.delete("/:id", permitirRoles("Administrador"), UsuariosController.eliminar);

export default router;
