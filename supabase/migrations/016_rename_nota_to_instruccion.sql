-- Renombrar tipo de entidad de nota a instruccion
UPDATE entities SET type = 'instruccion' WHERE type = 'nota';
