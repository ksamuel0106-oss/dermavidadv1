import jwt from "jsonwebtoken";

/*
 * Verifica que la petición traiga un token JWT válido en el encabezado:
 *   Authorization: Bearer <token>
 * Si es válido, deja los datos del usuario en req.usuario
 */
export function verificarToken(req, res, next) {
    const encabezado = req.headers.authorization || "";
    const [tipo, token] = encabezado.split(" ");

    if (tipo !== "Bearer" || !token) {
        return res.status(401).json({ mensaje: "Acceso denegado. Inicie sesión." });
    }

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        const mensaje = error.name === "TokenExpiredError"
            ? "Su sesión expiró. Inicie sesión nuevamente."
            : "Token inválido.";
        return res.status(401).json({ mensaje });
    }
}

/*
 * Restringe una ruta a ciertos roles.
 * Uso: permitirRoles("Administrador", "Recepción")
 */
export function permitirRoles(...roles) {
    return (req, res, next) => {
        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            return res.status(403).json({ mensaje: "No tiene permisos para realizar esta acción." });
        }
        next();
    };
}
