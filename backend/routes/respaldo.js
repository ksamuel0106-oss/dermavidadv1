import express from "express";
import RespaldoController from "../controllers/respaldoController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(verificarToken, permitirRoles("Administrador"));

router.get("/info", RespaldoController.info);
router.get("/descargar", RespaldoController.descargar);
router.post("/restaurar", RespaldoController.restaurar);

export default router;
