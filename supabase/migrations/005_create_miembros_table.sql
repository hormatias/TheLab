-- Crear tabla de miembros
CREATE TABLE IF NOT EXISTS miembros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_miembros_nombre ON miembros(nombre);

-- Crear índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_miembros_email ON miembros(email);

-- Habilitar Row Level Security
ALTER TABLE miembros ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Permitir lectura pública" ON miembros
  FOR SELECT USING (true);

-- Política para permitir inserción
CREATE POLICY "Permitir inserción pública" ON miembros
  FOR INSERT WITH CHECK (true);

-- Política para permitir actualización
CREATE POLICY "Permitir actualización pública" ON miembros
  FOR UPDATE USING (true);

-- Política para permitir eliminación
CREATE POLICY "Permitir eliminación pública" ON miembros
  FOR DELETE USING (true);
