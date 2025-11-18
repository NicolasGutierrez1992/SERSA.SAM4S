-- Table: public.descargas

-- DROP TABLE IF EXISTS public.descargas;

CREATE TABLE IF NOT EXISTS public.descargas
(
    id_usuario integer,
    id_certificado character varying(50) COLLATE pg_catalog."default",
    "estadoMayorista" text COLLATE pg_catalog."default" DEFAULT 'Pendiente de Facturar'::text,
    "tamaño" bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    certificado_nombre character varying(255) COLLATE pg_catalog."default",
    "estadoDistribuidor" text COLLATE pg_catalog."default" DEFAULT 'Pendiente de Facturar'::text,
    id_descarga bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 0 MINVALUE 0 MAXVALUE 9223372036854775807 CACHE 1 ),
    CONSTRAINT descargas_id_certificado_fkey FOREIGN KEY (id_certificado)
        REFERENCES public.certificados_v2 (id_certificado) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT descargas_id_usuario_fkey FOREIGN KEY (id_usuario)
        REFERENCES public.users (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT descargas_estado_distribuidor_check CHECK ("estadoDistribuidor" = ANY (ARRAY['Pendiente de Facturar'::text, 'Facturado'::text, 'Cobrado'::text])),
    CONSTRAINT descargas_estado_mayorista_check CHECK ("estadoMayorista" = ANY (ARRAY['Pendiente de Facturar'::text, 'Facturado'::text, 'Cobrado'::text]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.descargas
    OWNER to s3rs4;

COMMENT ON TABLE public.descargas
    IS 'Esta tabla posee información de las descargas que realiza el usuario sobre un certificado almacenado en la tabla ceritificados_v2. ';

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