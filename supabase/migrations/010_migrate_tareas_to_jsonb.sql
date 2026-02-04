-- Migrar tareas de tabla separada a campo JSONB en proyectos

-- 1. Agregar columna tareas JSONB a proyectos
ALTER TABLE proyectos
ADD COLUMN IF NOT EXISTS tareas JSONB DEFAULT '[]'::jsonb;

-- 2. Migrar datos existentes de la tabla tareas al campo JSONB
-- Cada tarea se convierte en un objeto JSON con: id, nombre, completada, fecha_inicio, fecha_fin, created_at
UPDATE proyectos p
SET tareas = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', t.id::text,
        'nombre', t.nombre,
        'completada', t.completada,
        'fecha_inicio', null,
        'fecha_fin', null,
        'created_at', t.created_at
      )
      ORDER BY t.completada ASC, t.created_at DESC
    )
    FROM tareas t
    WHERE t.proyecto_id = p.id
  ),
  '[]'::jsonb
);

-- 3. Eliminar el trigger antes de eliminar la tabla
DROP TRIGGER IF EXISTS update_tareas_updated_at ON tareas;

-- 4. Eliminar la tabla tareas
DROP TABLE IF EXISTS tareas;

-- Nota: La funcion update_updated_at_column() se mantiene porque puede ser usada por otras tablas
