-- Añadir columna descripcion para guardar el JSON de OpenAI
ALTER TABLE formularios ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Comentario de la columna
COMMENT ON COLUMN formularios.descripcion IS 'JSON con la respuesta de OpenAI describiendo los campos del formulario';
