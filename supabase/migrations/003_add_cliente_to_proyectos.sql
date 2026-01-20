-- Agregar relación con clientes a la tabla proyectos
ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

-- Crear índice para búsquedas por cliente
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id ON proyectos(cliente_id);
