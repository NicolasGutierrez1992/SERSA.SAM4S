-- Table: public.certificados_v2

-- DROP TABLE IF EXISTS public.certificados_v2;

CREATE TABLE IF NOT EXISTS public.certificados_v2
(
    id_certificado character varying(50) COLLATE pg_catalog."default" NOT NULL,
    fabricante character varying(10) COLLATE pg_catalog."default" NOT NULL DEFAULT 'SE'::character varying,
    marca character varying(10) COLLATE pg_catalog."default" NOT NULL,
    modelo character varying(10) COLLATE pg_catalog."default" NOT NULL,
    numero_serie character varying(20) COLLATE pg_catalog."default" NOT NULL,
    metadata jsonb,
    archivo_referencia text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT certificados_v2_pkey PRIMARY KEY (id_certificado),
    CONSTRAINT certificados_v2_fabricante_check CHECK (fabricante::text = 'SE'::text),
    CONSTRAINT certificados_v2_marca_check CHECK (marca::text = 'SH'::text),
    CONSTRAINT certificados_v2_modelo_check CHECK (modelo::text = ANY (ARRAY['IA'::character varying, 'RA'::character varying]::text[]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.certificados_v2
    OWNER to s3rs4;

COMMENT ON TABLE public.certificados_v2
    IS 'Esta tabla posee la información del certificado descargada desde el portal de ARCA/AFIP. 
';

COMMENT ON COLUMN public.certificados_v2.id_certificado
    IS '**Numero Único de serie del controlador fiscal**';

COMMENT ON COLUMN public.certificados_v2.metadata
    IS '**contenido del certificado descargado**';

COMMENT ON COLUMN public.certificados_v2.archivo_referencia
    IS '**Nombre del archivo .pem que se descargó**';

COMMENT ON COLUMN public.certificados_v2.created_at
    IS '**fecha de la primera descarga**';

COMMENT ON COLUMN public.certificados_v2.updated_at
    IS '**Fecha de la ultima descarga que se realizó para este controlador**';