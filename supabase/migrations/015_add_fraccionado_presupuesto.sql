-- Actualizar datos existentes en entities.data para renombrar periodos_recurrencia a numero_cuotas
-- Esto mantiene consistencia con el nuevo nombre genérico que sirve tanto para recurrente como fraccionado

UPDATE entities
SET data = jsonb_set(
  data - 'periodos_recurrencia',
  '{numero_cuotas}',
  data->'periodos_recurrencia'
)
WHERE type = 'proyecto'
  AND data ? 'periodos_recurrencia'
  AND data->>'periodos_recurrencia' IS NOT NULL;
