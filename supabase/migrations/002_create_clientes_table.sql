-- Crear tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

-- Crear índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);

-- Habilitar Row Level Security
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Permitir lectura pública" ON clientes
  FOR SELECT USING (true);

-- Política para permitir inserción
CREATE POLICY "Permitir inserción pública" ON clientes
  FOR INSERT WITH CHECK (true);

-- Política para permitir actualización
CREATE POLICY "Permitir actualización pública" ON clientes
  FOR UPDATE USING (true);

-- Política para permitir eliminación
CREATE POLICY "Permitir eliminación pública" ON clientes
  FOR DELETE USING (true);
