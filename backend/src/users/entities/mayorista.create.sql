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