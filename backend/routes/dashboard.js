import express from "express";
import DashboardController from "../controllers/dashboardController.js";
import { verificarToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verificarToken, DashboardController.resumen);

export default router;
