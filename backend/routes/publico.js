import express from "express";
import PublicoController from "../controllers/publicoController.js";

const router = express.Router();

router.get("/servicios", PublicoController.servicios);
router.get("/dermatologos", PublicoController.dermatologos);
router.get("/estadisticas", PublicoController.estadisticas);

export default router;
