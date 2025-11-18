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