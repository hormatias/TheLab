-- Agregar campo descripción a la tabla proyectos
ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS descripcion TEXT;
