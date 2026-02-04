-- =====================================================
-- IMPORTANTE: Solo ejecutar esta migración después de:
-- 1. Haber ejecutado 013_create_entities_table.sql
-- 2. Haber validado que la aplicación funciona correctamente
-- 3. Haber verificado que los datos migraron correctamente
-- =====================================================

-- Eliminar tabla de relación primero (tiene foreign keys)
DROP TABLE IF EXISTS proyecto_miembros CASCADE;

-- Eliminar tablas principales
DROP TABLE IF EXISTS proyectos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS miembros CASCADE;
DROP TABLE IF EXISTS formularios CASCADE;

-- Eliminar funciones que ya no se usan (si existen)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
