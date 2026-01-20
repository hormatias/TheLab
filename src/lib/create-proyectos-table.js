import { supabase } from './supabase.js';

/**
 * Intenta crear la tabla de proyectos usando una función SQL
 * Nota: Esto requiere que tengas una función en Supabase o permisos de admin
 */
export async function createProyectosTable() {
  try {
    // Intentar crear la tabla usando una función RPC (si existe)
    // Primero, intentamos crear la tabla directamente con SQL a través de una función
    const { data, error } = await supabase.rpc('create_proyectos_table');

    if (error) {
      // Si no existe la función RPC, necesitamos crear la tabla manualmente
      throw new Error('No se puede crear la tabla automáticamente. Usa el SQL proporcionado.');
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Retorna el SQL necesario para crear la tabla
 */
export function getCreateTableSQL() {
  return `
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
`;
}
