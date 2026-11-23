import express from "express";
import FacturasController from "../controllers/facturasController.js";
import { verificarToken, permitirRoles } from "../middleware/auth.js";

const router = express.Router();
const CAJA = ["Administrador", "Recepción"];

router.use(verificarToken);

router.get("/", permitirRoles(...CAJA), FacturasController.listar);
router.get("/:id", permitirRoles(...CAJA), FacturasController.buscar);
router.get("/:id/pdf", permitirRoles(...CAJA, "Dermatólogo"), FacturasController.pdf);
router.patch("/:id/anular", permitirRoles("Administrador"), FacturasController.anular);

export default router;
