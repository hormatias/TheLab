-- Crear tabla de formularios
CREATE TABLE IF NOT EXISTS formularios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  pdf_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_formularios_nombre ON formularios(nombre);

-- Habilitar Row Level Security
ALTER TABLE formularios ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Permitir lectura pública" ON formularios
  FOR SELECT USING (true);

-- Política para permitir inserción
CREATE POLICY "Permitir inserción pública" ON formularios
  FOR INSERT WITH CHECK (true);

-- Política para permitir actualización
CREATE POLICY "Permitir actualización pública" ON formularios
  FOR UPDATE USING (true);

-- Política para permitir eliminación
CREATE POLICY "Permitir eliminación pública" ON formularios
  FOR DELETE USING (true);
