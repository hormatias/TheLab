-- Crear tabla unificada de entidades con JSONB
-- Esta tabla reemplaza: proyectos, clientes, miembros, formularios, proyecto_miembros

CREATE TABLE IF NOT EXISTS entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_data ON entities USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_entities_nombre ON entities((data->>'nombre'));
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);

-- Habilitar Row Level Security
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (igual que las tablas anteriores)
CREATE POLICY "Permitir lectura pública" ON entities
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserción pública" ON entities
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización pública" ON entities
  FOR UPDATE USING (true);

CREATE POLICY "Permitir eliminación pública" ON entities
  FOR DELETE USING (true);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_entities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_entities_updated_at();

-- ============================================
-- MIGRACIÓN DE DATOS EXISTENTES
-- ============================================

-- Migrar clientes (tabla clientes no tiene created_at)
INSERT INTO entities (id, type, data, created_at)
SELECT 
  id,
  'cliente',
  jsonb_build_object('nombre', nombre),
  NOW()
FROM clientes
ON CONFLICT (id) DO NOTHING;

-- Migrar miembros
INSERT INTO entities (id, type, data, created_at)
SELECT 
  id,
  'miembro',
  jsonb_build_object(
    'nombre', nombre,
    'email', email
  ),
  COALESCE(created_at, NOW())
FROM miembros
ON CONFLICT (id) DO NOTHING;

-- Migrar formularios
INSERT INTO entities (id, type, data, created_at)
SELECT 
  id,
  'formulario',
  jsonb_build_object(
    'nombre', nombre,
    'descripcion', descripcion,
    'pdf_path', pdf_path
  ),
  COALESCE(created_at, NOW())
FROM formularios
ON CONFLICT (id) DO NOTHING;

-- Migrar proyectos (con miembro_ids agregados desde proyecto_miembros)
INSERT INTO entities (id, type, data, created_at)
SELECT 
  p.id,
  'proyecto',
  jsonb_build_object(
    'nombre', p.nombre,
    'descripcion', p.descripcion,
    'cliente_id', p.cliente_id,
    'tareas', COALESCE(p.tareas, '[]'::jsonb),
    'presupuesto', p.presupuesto,
    'moneda', COALESCE(p.moneda, 'EUR'),
    'tipo_presupuesto', COALESCE(p.tipo_presupuesto, 'unico'),
    'frecuencia_recurrencia', p.frecuencia_recurrencia,
    'numero_cuotas', p.numero_cuotas,
    'miembro_ids', COALESCE(
      (
        SELECT jsonb_agg(pm.miembro_id)
        FROM proyecto_miembros pm
        WHERE pm.proyecto_id = p.id
      ),
      '[]'::jsonb
    )
  ),
  COALESCE(p.created_at, NOW())
FROM proyectos p
ON CONFLICT (id) DO NOTHING;
