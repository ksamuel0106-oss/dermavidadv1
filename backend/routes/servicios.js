import express from "express";
import ServiciosController from "../controllers/serviciosController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(verificarToken);

// Consultar
router.get("/", permitirRoles("Administrador", "Recepción", "Dermatólogo"), ServiciosController.listar);
router.get("/:id", permitirRoles("Administrador", "Recepción", "Dermatólogo"), ServiciosController.buscar);

// Crear
router.post("/", permitirRoles("Administrador"), ServiciosController.crear);

// Actualizar
router.put("/:id", permitirRoles("Administrador"), ServiciosController.actualizar);

// Eliminar
router.delete("/:id", permitirRoles("Administrador"), ServiciosController.eliminar);

export default router;
