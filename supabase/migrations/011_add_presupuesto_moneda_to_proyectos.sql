-- Agregar campos de presupuesto y moneda a la tabla proyectos
ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS presupuesto NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'EUR';

-- Crear índice para búsquedas por presupuesto (opcional, útil para filtros)
CREATE INDEX IF NOT EXISTS idx_proyectos_presupuesto ON proyectos(presupuesto) WHERE presupuesto IS NOT NULL;
