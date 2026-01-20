-- Crear tabla intermedia para relación N:M entre proyectos y miembros
CREATE TABLE IF NOT EXISTS proyecto_miembros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  miembro_id UUID NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(proyecto_id, miembro_id)
);

-- Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_proyecto_miembros_proyecto_id ON proyecto_miembros(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_miembros_miembro_id ON proyecto_miembros(miembro_id);

-- Habilitar Row Level Security
ALTER TABLE proyecto_miembros ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Permitir lectura pública" ON proyecto_miembros
  FOR SELECT USING (true);

-- Política para permitir inserción
CREATE POLICY "Permitir inserción pública" ON proyecto_miembros
  FOR INSERT WITH CHECK (true);

-- Política para permitir actualización
CREATE POLICY "Permitir actualización pública" ON proyecto_miembros
  FOR UPDATE USING (true);

-- Política para permitir eliminación
CREATE POLICY "Permitir eliminación pública" ON proyecto_miembros
  FOR DELETE USING (true);
