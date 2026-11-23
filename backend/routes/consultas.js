import express from "express";
import ConsultasController from "../controllers/consultasController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();
const CLINICOS = ["Administrador", "Dermatólogo"];

router.use(verificarToken);

router.get("/pendientes", permitirRoles(...CLINICOS), ConsultasController.pendientes);
router.get("/", permitirRoles(...CLINICOS), ConsultasController.listar);
router.get("/:id", permitirRoles(...CLINICOS), ConsultasController.buscar);
router.get("/:id/receta", permitirRoles(...CLINICOS), ConsultasController.recetaPDF);
router.post("/", permitirRoles(...CLINICOS), ConsultasController.atender);
router.put("/:id", permitirRoles(...CLINICOS), ConsultasController.actualizar);
router.delete("/:id", permitirRoles("Administrador"), ConsultasController.eliminar);

export default router;
