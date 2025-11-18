### Modelo de datos esencial
script de bd en produccion
-- Database: db_sersa

-- DROP DATABASE IF EXISTS db_sersa;

CREATE DATABASE db_sersa
    WITH
    OWNER = s3rs4
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF8'
    LC_CTYPE = 'en_US.UTF8'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;

ALTER DATABASE db_sersa
    SET "TimeZone" TO 'utc';

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
GRANT ALL ON TABLES TO s3rs4;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
GRANT ALL ON SEQUENCES TO s3rs4;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
GRANT EXECUTE ON FUNCTIONS TO s3rs4;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
GRANT USAGE ON TYPES TO s3rs4;
----

##TABLES
-- Table: public.auditoria

-- DROP TABLE IF EXISTS public.auditoria;

CREATE TABLE IF NOT EXISTS public.auditoria
(
    id_auditoria uuid NOT NULL DEFAULT gen_random_uuid(),
    actor_id integer,
    accion text COLLATE pg_catalog."default" NOT NULL,
    objetivo_tipo text COLLATE pg_catalog."default" NOT NULL,
    objetivo_id text COLLATE pg_catalog."default",
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip text COLLATE pg_catalog."default",
    antes jsonb,
    despues jsonb,
    CONSTRAINT auditoria_pkey PRIMARY KEY (id_auditoria),
    CONSTRAINT auditoria_actor_id_fkey FOREIGN KEY (actor_id)
        REFERENCES public.users (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.auditoria
    OWNER to s3rs4;
-- Index: idx_auditoria_actor

-- DROP INDEX IF EXISTS public.idx_auditoria_actor;

CREATE INDEX IF NOT EXISTS idx_auditoria_actor
    ON public.auditoria USING btree
    (actor_id ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_auditoria_timestamp

-- DROP INDEX IF EXISTS public.idx_auditoria_timestamp;

CREATE INDEX IF NOT EXISTS idx_auditoria_timestamp
    ON public.auditoria USING btree
    ("timestamp" ASC NULLS LAST)
    TABLESPACE pg_default;
	
	-- Table: public.certificados_v2

-- DROP TABLE IF EXISTS public.certificados_v2;

CREATE TABLE IF NOT EXISTS public.certificados_v2
(
    id_certificado uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre text COLLATE pg_catalog."default" NOT NULL,
    controlador_id text COLLATE pg_catalog."default",
    metadata jsonb,
    archivo_referencia text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT certificados_v2_pkey PRIMARY KEY (id_certificado)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.certificados_v2
    OWNER to s3rs4;
	
	
-- Table: public.descargas

-- DROP TABLE IF EXISTS public.descargas;

CREATE TABLE IF NOT EXISTS public.descargas
(
    id_usuario integer,
    id_certificado uuid,
    "estadoMayorista" text COLLATE pg_catalog."default" DEFAULT 'Pendiente de Facturar'::text,
    "tamaño" bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    certificado_nombre character varying(255) COLLATE pg_catalog."default",
    "estadoDistribuidor" text COLLATE pg_catalog."default" DEFAULT 'Pendiente de Facturar'::text,
    id_descarga bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 0 MINVALUE 0 MAXVALUE 9223372036854775807 CACHE 1 ),
    CONSTRAINT descargas_id_usuario_fkey FOREIGN KEY (id_usuario)
        REFERENCES public.users (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT descargas_estado_check CHECK ("estadoMayorista" = ANY (ARRAY['Pendiente de Facturar'::text, 'Facturado'::text]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.descargas
    OWNER to s3rs4;

COMMENT ON COLUMN public.descargas.id_usuario
    IS '**Id del usuario que realice la descarga**';

COMMENT ON COLUMN public.descargas.id_certificado
    IS '**Numero Único de serie del controlador fiscal**';

COMMENT ON COLUMN public.descargas."estadoMayorista"
    IS '**Estado de deuda del mayorista con el Administrador**
(Pendiente de Facturar - Facturado - Pago)';

COMMENT ON COLUMN public.descargas."tamaño"
    IS '** Tamaño del archivo .pem almacenado en la tabla Ceritificados.**';

COMMENT ON COLUMN public.descargas.created_at
    IS '**fecha de Descarga del certificado**';

COMMENT ON COLUMN public.descargas.updated_at
    IS '**fecha de actualización de estado del certificado**';

COMMENT ON COLUMN public.descargas.certificado_nombre
    IS 'Nombre descriptivo del certificado generado';

COMMENT ON COLUMN public.descargas."estadoDistribuidor"
    IS '**Estado de deuda del distribuidor con el Mayorista**
(Pendiente de Facturar - Facturado - Pago)';

COMMENT ON COLUMN public.descargas.id_descarga
    IS '**Id de descarga . Incremental**';
-- Index: idx_descargas_certificado_nombre

-- DROP INDEX IF EXISTS public.idx_descargas_certificado_nombre;

CREATE INDEX IF NOT EXISTS idx_descargas_certificado_nombre
    ON public.descargas USING btree
    (certificado_nombre COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_descargas_estado

-- DROP INDEX IF EXISTS public.idx_descargas_estado;

CREATE INDEX IF NOT EXISTS idx_descargas_estado
    ON public.descargas USING btree
    ("estadoMayorista" COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;
-- Index: idx_descargas_usuario

-- DROP INDEX IF EXISTS public.idx_descargas_usuario;

CREATE INDEX IF NOT EXISTS idx_descargas_usuario
    ON public.descargas USING btree
    (id_usuario ASC NULLS LAST)
    TABLESPACE pg_default;
	
	
	-- Table: public.mayoristas

-- DROP TABLE IF EXISTS public.mayoristas;

CREATE TABLE IF NOT EXISTS public.mayoristas
(
    id_mayorista integer NOT NULL DEFAULT nextval('mayoristas_id_mayorista_seq'::regclass),
    nombre text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT mayoristas_pkey PRIMARY KEY (id_mayorista)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.mayoristas
    OWNER to s3rs4;
	
	
	-- Table: public.notificaciones

-- DROP TABLE IF EXISTS public.notificaciones;

CREATE TABLE IF NOT EXISTS public.notificaciones
(
    id_notificacion uuid NOT NULL DEFAULT gen_random_uuid(),
    tipo text COLLATE pg_catalog."default" NOT NULL,
    destinatario_id integer,
    estado_envio text COLLATE pg_catalog."default" DEFAULT 'Pendiente'::text,
    fecha timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payload jsonb,
    CONSTRAINT notificaciones_pkey PRIMARY KEY (id_notificacion),
    CONSTRAINT notificaciones_destinatario_id_fkey FOREIGN KEY (destinatario_id)
        REFERENCES public.users (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT notificaciones_estado_envio_check CHECK (estado_envio = ANY (ARRAY['Pendiente'::text, 'Enviado'::text, 'Error'::text]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.notificaciones
    OWNER to s3rs4;
	
	-- Table: public.roles

-- DROP TABLE IF EXISTS public.roles;

CREATE TABLE IF NOT EXISTS public.roles
(
    id_rol integer,
    rol text COLLATE pg_catalog."default"
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.roles
    OWNER to s3rs4;
	
	-- Table: public.users

-- DROP TABLE IF EXISTS public.users;

CREATE TABLE IF NOT EXISTS public.users
(
    status integer,
    id_rol integer,
    nombre text COLLATE pg_catalog."default",
    mail text COLLATE pg_catalog."default",
    password text COLLATE pg_catalog."default",
    id_usuario integer NOT NULL DEFAULT nextval('users_id_usuario_seq'::regclass),
    must_change_password boolean DEFAULT false,
    id_mayorista integer,
    cuit text COLLATE pg_catalog."default",
    limite_descargas integer DEFAULT 5,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ultimo_login timestamp without time zone,
    CONSTRAINT users_pkey PRIMARY KEY (id_usuario)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.users
    OWNER to s3rs4;
	