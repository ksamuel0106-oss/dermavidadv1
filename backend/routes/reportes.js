import express from "express";
import ReportesController from "../controllers/reportesController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(verificarToken, permitirRoles("Administrador", "Recepción"));

router.get("/", ReportesController.catalogo);
router.get("/:tipo", ReportesController.generar);

export default router;
