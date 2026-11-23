import express from "express";
import AuthController from "../controllers/authController.js";
import { verificarToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", AuthController.login);
router.get("/perfil", verificarToken, AuthController.perfil);
router.put("/password", verificarToken, AuthController.cambiarPassword);

export default router;
