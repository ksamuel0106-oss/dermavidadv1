import express from "express";
import PacientesController from "../controllers/pacientesController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(verificarToken);

// Consultar
router.get("/", permitirRoles("Administrador", "Recepción", "Dermatólogo"), PacientesController.listar);
router.get("/:id", permitirRoles("Administrador", "Recepción", "Dermatólogo"), PacientesController.buscar);

// Crear
router.post("/", permitirRoles("Administrador", "Recepción"), PacientesController.crear);

// Actualizar
router.put("/:id", permitirRoles("Administrador", "Recepción"), PacientesController.actualizar);

// Eliminar
router.delete("/:id", permitirRoles("Administrador"), PacientesController.eliminar);

export default router;
