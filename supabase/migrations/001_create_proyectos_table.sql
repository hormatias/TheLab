-- Crear tabla de proyectos
CREATE TABLE IF NOT EXISTS proyectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

-- Crear índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_proyectos_nombre ON proyectos(nombre);

-- Habilitar Row Level Security
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Permitir lectura pública" ON proyectos
  FOR SELECT USING (true);

-- Política para permitir inserción
CREATE POLICY "Permitir inserción pública" ON proyectos
  FOR INSERT WITH CHECK (true);

-- Política para permitir actualización
CREATE POLICY "Permitir actualización pública" ON proyectos
  FOR UPDATE USING (true);

-- Política para permitir eliminación
CREATE POLICY "Permitir eliminación pública" ON proyectos
  FOR DELETE USING (true);
