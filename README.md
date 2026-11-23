# 🌿 Clínica Dermatológica DermaVida — Sistema Web

Proyecto final de **Laboratorio de Programación III** (UCATECI).
Aplicación web para gestionar pacientes, agenda de citas, atención dermatológica, facturación, reportes y respaldo de la base de datos.

**Tecnologías:** HTML5 · CSS3 · JavaScript · Node.js · Express · PostgreSQL · JWT · bcrypt · PDFKit · ExcelJS

---

## 1. Requisitos
- [Node.js 18 o superior](https://nodejs.org)
- [PostgreSQL 14 o superior](https://www.postgresql.org/download/) (con pgAdmin)

## 2. Instalación local (Windows)

```bash
# 1) Abrir una terminal en la carpeta del proyecto e instalar dependencias
cd backend
npm install

# 2) Crear el archivo de configuración
copy .env.example .env
#    Edite .env y ponga la contraseña de su usuario postgres en DB_PASSWORD

# 3) Crear la base de datos, las tablas y los datos de prueba (automático)
npm run init-db

# 4) Iniciar el servidor
npm start
```

Abrir en el navegador: **http://localhost:3000**

> Alternativa con pgAdmin: cree la base `clinica_dermatologica` y ejecute el script
> `database/clinica_dermatologica_completo.sql` en el Query Tool.

## 3. Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@dermavida.do | `Admin123*` |
| Recepción | recepcion@dermavida.do | `Recepcion123*` |
| Dermatóloga | lmendez@dermavida.do | `Doctor123*` |

## 4. Cumplimiento de la rúbrica

| Requisito | Dónde está |
|---|---|
| Diseño responsivo | `frontend/css/styles.css` (menú lateral deslizable, tablas → tarjetas en móvil) |
| Contenido e imágenes | Página pública `index.html` (servicios desde la BD, especialistas, regla ABCDE) + ilustraciones en `frontend/img` |
| **Proceso 1: Agendamiento de citas** | `backend/controllers/citasController.js` — valida horario del dermatólogo, duración del servicio, choques, fechas pasadas y domingos; muestra horarios disponibles |
| **Proceso 2: Atención y facturación** | `backend/controllers/consultasController.js` — en una transacción registra la consulta, marca la cita como Atendida y genera la factura (seguro + descuento) |
| CRUD | Pacientes, Dermatólogos, Servicios, Usuarios, Citas, Consultas |
| Base de datos (7 tablas relacionadas) | `database/schema.sql` |
| Reportes PDF y Excel | Módulo Reportes (5 reportes), factura y receta en PDF |
| Seguridad | JWT (`middleware/auth.js`), roles, contraseñas con bcrypt |
| Respaldo | Módulo Respaldo: descarga `.sql` completo y restauración |

## 5. Estructura
```
clinica-dermatologica/
├── backend/
│   ├── config/db.js            Conexión a PostgreSQL (pg Pool)
│   ├── middleware/auth.js      Verificación de JWT y roles
│   ├── controllers/            Lógica de negocio de cada módulo
│   ├── routes/                 Endpoints REST /api/...
│   ├── utils/                  PDF, Excel y manejo de errores
│   ├── scripts/init-db.js      Crea tablas y datos iniciales
│   └── server.js               Servidor Express (sirve API + frontend)
├── frontend/
│   ├── index.html, login.html  Sitio público y acceso
│   ├── app/                    Páginas del sistema (requieren sesión)
│   ├── css/styles.css          Estilos (paleta del proyecto Consultorio)
│   ├── js/                     Lógica del cliente (fetch + JWT)
│   └── img/                    Logo e ilustraciones SVG
└── database/                   Scripts SQL
```

## 6. Publicar en Internet (Render, con base de datos incluida)
El archivo `render.yaml` crea en Render la web y la base PostgreSQL juntas, y las conecta solas.
Al primer arranque el servidor detecta que la base está vacía y crea las tablas con los datos de prueba.

1. Suba el proyecto a un repositorio de GitHub (el `.gitignore` excluye `node_modules` y `.env`).
2. En **[Render](https://render.com)** -> *New* -> *Blueprint* -> conecte el repositorio -> *Apply*.
3. Espere a que termine el despliegue. El enlace será del tipo `https://dermavida.onrender.com`.

No hay que configurar variables a mano: `DATABASE_URL` sale de la base creada y `JWT_SECRET` se genera solo.

Notas del plan gratis de Render:
- La base gratis vence a los 30 días de creada (después hay 14 días para pasarla a pago antes de que se borre).
- Solo se permite una base gratis activa por cuenta.
- La web se duerme tras 15 minutos sin visitas; la primera visita después tarda cerca de un minuto.

Para volver a cargar los datos de prueba desde su PC: copie la *External Database URL* de la base en Render,
póngala como `DATABASE_URL` en `backend/.env` y ejecute `npm run init-db` (borra y recrea todo).

## 7. Fotografías opcionales
La página pública usa ilustraciones propias. Para usar fotografías, coloque `hero.jpg` y `clinica.jpg` en `frontend/img/fotos/` (ver LEEME.txt).
