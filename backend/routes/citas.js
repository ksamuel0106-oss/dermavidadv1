import express from "express";
import CitasController from "../controllers/citasController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();
const TODOS = ["Administrador", "Recepción", "Dermatólogo"];
const AGENDA = ["Administrador", "Recepción"];

router.use(verificarToken);

router.get("/", permitirRoles(...TODOS), CitasController.listar);
router.get("/disponibilidad", permitirRoles(...TODOS), CitasController.disponibilidad);
router.get("/:id", permitirRoles(...TODOS), CitasController.buscar);
router.post("/", permitirRoles(...AGENDA), CitasController.crear);
router.put("/:id", permitirRoles(...AGENDA), CitasController.actualizar);
router.patch("/:id/estado", permitirRoles(...AGENDA), CitasController.cambiarEstado);
router.delete("/:id", permitirRoles(...AGENDA), CitasController.eliminar);

export default router;
