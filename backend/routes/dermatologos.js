import express from "express";
import DermatologosController from "../controllers/dermatologosController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(verificarToken);

// Consultar
router.get("/", permitirRoles("Administrador", "Recepción", "Dermatólogo"), DermatologosController.listar);
router.get("/:id", permitirRoles("Administrador", "Recepción", "Dermatólogo"), DermatologosController.buscar);

// Crear
router.post("/", permitirRoles("Administrador"), DermatologosController.crear);

// Actualizar
router.put("/:id", permitirRoles("Administrador"), DermatologosController.actualizar);

// Eliminar
router.delete("/:id", permitirRoles("Administrador"), DermatologosController.eliminar);

export default router;
