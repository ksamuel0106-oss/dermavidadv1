-- =====================================================================
--  CLÍNICA DERMATOLÓGICA DERMAVIDA
--  Script de estructura de la base de datos (PostgreSQL)
--  Laboratorio de Programación III - UCATECI
-- =====================================================================
--  Ejecutar conectado a la base de datos "clinica_dermatologica".
--  Para crearla:  CREATE DATABASE clinica_dermatologica;
-- =====================================================================

DROP TABLE IF EXISTS facturas      CASCADE;
DROP TABLE IF EXISTS consultas     CASCADE;
DROP TABLE IF EXISTS citas         CASCADE;
DROP TABLE IF EXISTS usuarios      CASCADE;
DROP TABLE IF EXISTS servicios     CASCADE;
DROP TABLE IF EXISTS dermatologos  CASCADE;
DROP TABLE IF EXISTS pacientes     CASCADE;

-- ---------------------------------------------------------------------
-- PACIENTES
-- ---------------------------------------------------------------------
CREATE TABLE pacientes (
    id_paciente       SERIAL PRIMARY KEY,
    cedula            VARCHAR(13)  NOT NULL UNIQUE,
    nombre            VARCHAR(80)  NOT NULL,
    apellido          VARCHAR(80)  NOT NULL,
    fecha_nacimiento  DATE         NOT NULL,
    sexo              CHAR(1)      NOT NULL CHECK (sexo IN ('F','M')),
    telefono          VARCHAR(20)  NOT NULL,
    correo            VARCHAR(120),
    direccion         VARCHAR(200),
    tipo_piel         VARCHAR(10)  NOT NULL DEFAULT 'III'
                      CHECK (tipo_piel IN ('I','II','III','IV','V','VI')),
    alergias          VARCHAR(250),
    seguro_medico     VARCHAR(60)  NOT NULL DEFAULT 'Ninguno',
    creado_en         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- DERMATÓLOGOS
-- ---------------------------------------------------------------------
CREATE TABLE dermatologos (
    id_dermatologo  SERIAL PRIMARY KEY,
    nombre          VARCHAR(80)  NOT NULL,
    apellido        VARCHAR(80)  NOT NULL,
    especialidad    VARCHAR(80)  NOT NULL,
    exequatur       VARCHAR(20)  NOT NULL UNIQUE,
    telefono        VARCHAR(20),
    correo          VARCHAR(120),
    horario_inicio  TIME         NOT NULL DEFAULT '08:00',
    horario_fin     TIME         NOT NULL DEFAULT '17:00',
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_horario CHECK (horario_fin > horario_inicio)
);

-- ---------------------------------------------------------------------
-- SERVICIOS (catálogo de procedimientos)
-- ---------------------------------------------------------------------
CREATE TABLE servicios (
    id_servicio   SERIAL PRIMARY KEY,
    nombre        VARCHAR(100)   NOT NULL UNIQUE,
    categoria     VARCHAR(40)    NOT NULL
                  CHECK (categoria IN ('Clínica','Estética','Quirúrgica','Diagnóstica')),
    descripcion   VARCHAR(300),
    precio        NUMERIC(10,2)  NOT NULL CHECK (precio >= 0),
    duracion_min  INTEGER        NOT NULL CHECK (duracion_min BETWEEN 10 AND 240),
    activo        BOOLEAN        NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- USUARIOS DEL SISTEMA (autenticación JWT)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario      SERIAL PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    correo          VARCHAR(120) NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    rol             VARCHAR(20)  NOT NULL
                    CHECK (rol IN ('Administrador','Recepción','Dermatólogo')),
    id_dermatologo  INTEGER REFERENCES dermatologos(id_dermatologo) ON DELETE SET NULL,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso   TIMESTAMP,
    creado_en       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- CITAS  (relaciona paciente + dermatólogo + servicio)
-- ---------------------------------------------------------------------
CREATE TABLE citas (
    id_cita         SERIAL PRIMARY KEY,
    id_paciente     INTEGER NOT NULL REFERENCES pacientes(id_paciente)       ON DELETE RESTRICT,
    id_dermatologo  INTEGER NOT NULL REFERENCES dermatologos(id_dermatologo) ON DELETE RESTRICT,
    id_servicio     INTEGER NOT NULL REFERENCES servicios(id_servicio)       ON DELETE RESTRICT,
    fecha           DATE    NOT NULL,
    hora            TIME    NOT NULL,
    motivo          VARCHAR(250),
    estado          VARCHAR(15) NOT NULL DEFAULT 'Pendiente'
                    CHECK (estado IN ('Pendiente','Confirmada','Atendida','Cancelada')),
    creado_por      INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_citas_fecha        ON citas(fecha);
CREATE INDEX idx_citas_dermatologo  ON citas(id_dermatologo, fecha);
CREATE INDEX idx_citas_paciente     ON citas(id_paciente);

-- ---------------------------------------------------------------------
-- CONSULTAS (resultado clínico de una cita atendida) 1:1 con citas
-- ---------------------------------------------------------------------
CREATE TABLE consultas (
    id_consulta      SERIAL PRIMARY KEY,
    id_cita          INTEGER NOT NULL UNIQUE REFERENCES citas(id_cita) ON DELETE CASCADE,
    diagnostico      VARCHAR(300) NOT NULL,
    tratamiento      VARCHAR(500) NOT NULL,
    receta           TEXT,
    observaciones    TEXT,
    proximo_control  DATE,
    fecha_registro   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- FACTURAS (cobro de la cita atendida) 1:1 con citas
-- ---------------------------------------------------------------------
CREATE TABLE facturas (
    id_factura        SERIAL PRIMARY KEY,
    numero            VARCHAR(12)   NOT NULL UNIQUE,
    id_cita           INTEGER       NOT NULL UNIQUE REFERENCES citas(id_cita) ON DELETE RESTRICT,
    subtotal          NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    cobertura_seguro  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cobertura_seguro >= 0),
    descuento         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total             NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    metodo_pago       VARCHAR(20)   NOT NULL
                      CHECK (metodo_pago IN ('Efectivo','Tarjeta','Transferencia','Seguro')),
    estado            VARCHAR(10)   NOT NULL DEFAULT 'Pagada' CHECK (estado IN ('Pagada','Anulada')),
    fecha             TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facturas_fecha ON facturas(fecha);
