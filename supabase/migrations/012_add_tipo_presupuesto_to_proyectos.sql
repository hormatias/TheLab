-- Agregar campos de tipo de presupuesto a la tabla proyectos
ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS tipo_presupuesto TEXT DEFAULT 'unico' CHECK (tipo_presupuesto IN ('unico', 'recurrente')),
ADD COLUMN IF NOT EXISTS frecuencia_recurrencia TEXT CHECK (frecuencia_recurrencia IN ('mensual', 'trimestral', 'semestral', 'anual')),
ADD COLUMN IF NOT EXISTS periodos_recurrencia INTEGER CHECK (periodos_recurrencia > 0);
