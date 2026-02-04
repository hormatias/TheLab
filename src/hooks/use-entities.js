import { supabase } from "@/lib/supabase";

/**
 * Hook genérico para operaciones CRUD sobre la tabla entities.
 * Reemplaza las llamadas directas a tablas específicas (proyectos, clientes, etc.)
 * 
 * @param {string} type - Tipo de entidad ('proyecto', 'cliente', 'miembro', 'formulario')
 * @returns {Object} Funciones para operar sobre entidades del tipo especificado
 */
export function useEntities(type) {
  /**
   * Lista todas las entidades del tipo especificado
   * @param {Object} options - Opciones de consulta
   * @param {string} options.orderBy - Campo por el cual ordenar (dentro de data)
   * @param {boolean} options.ascending - Orden ascendente o descendente
   * @param {Object} options.filters - Filtros adicionales sobre campos de data
   */
  async function list({ orderBy = "nombre", ascending = true, filters = {} } = {}) {
    let query = supabase
      .from("entities")
      .select("*")
      .eq("type", type);

    // Aplicar filtros sobre campos de data
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query = query.eq(`data->>${key}`, value);
      }
    });

    // Ordenar por campo dentro de data
    // Nota: PostgreSQL ordena JSONB como texto, lo cual funciona para nombres
    query = query.order(`data->>${orderBy}`, { ascending });

    const { data, error } = await query;

    if (error) throw error;

    // Transformar para mantener compatibilidad: aplanar data al nivel superior
    return {
      data: data?.map(flattenEntity) || [],
      error: null,
    };
  }

  /**
   * Obtiene una entidad por su ID
   * @param {string} id - UUID de la entidad
   */
  async function get(id) {
    const { data, error } = await supabase
      .from("entities")
      .select("*")
      .eq("id", id)
      .eq("type", type)
      .single();

    if (error) throw error;

    return {
      data: data ? flattenEntity(data) : null,
      error: null,
    };
  }

  /**
   * Crea una nueva entidad
   * @param {Object} entityData - Datos de la entidad (sin id, type, timestamps)
   */
  async function create(entityData) {
    const { data, error } = await supabase
      .from("entities")
      .insert([
        {
          type,
          data: entityData,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      data: data ? flattenEntity(data) : null,
      error: null,
    };
  }

  /**
   * Actualiza una entidad existente
   * @param {string} id - UUID de la entidad
   * @param {Object} updates - Campos a actualizar (se mezclan con data existente)
   */
  async function update(id, updates) {
    // Primero obtener el registro actual para mezclar data
    const { data: current, error: fetchError } = await supabase
      .from("entities")
      .select("data")
      .eq("id", id)
      .eq("type", type)
      .single();

    if (fetchError) throw fetchError;

    // Mezclar data existente con updates
    const newData = {
      ...current.data,
      ...updates,
    };

    const { data, error } = await supabase
      .from("entities")
      .update({ data: newData })
      .eq("id", id)
      .eq("type", type)
      .select()
      .single();

    if (error) throw error;

    return {
      data: data ? flattenEntity(data) : null,
      error: null,
    };
  }

  /**
   * Elimina una entidad por su ID
   * @param {string} id - UUID de la entidad
   */
  async function remove(id) {
    const { error } = await supabase
      .from("entities")
      .delete()
      .eq("id", id)
      .eq("type", type);

    if (error) throw error;

    return { error: null };
  }

  /**
   * Busca entidades por texto en el campo nombre
   * @param {string} searchTerm - Término de búsqueda
   */
  async function search(searchTerm) {
    const { data, error } = await supabase
      .from("entities")
      .select("*")
      .eq("type", type)
      .ilike("data->>nombre", `%${searchTerm}%`);

    if (error) throw error;

    return {
      data: data?.map(flattenEntity) || [],
      error: null,
    };
  }

  /**
   * Suscripción a cambios en tiempo real
   * @param {Function} callback - Función a llamar cuando hay cambios
   */
  function subscribe(callback) {
    const channel = supabase
      .channel(`entities:${type}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entities",
          filter: `type=eq.${type}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType,
            data: payload.new ? flattenEntity(payload.new) : null,
            oldData: payload.old ? flattenEntity(payload.old) : null,
          });
        }
      )
      .subscribe();

    // Retornar función para desuscribirse
    return () => supabase.removeChannel(channel);
  }

  return {
    list,
    get,
    create,
    update,
    remove,
    search,
    subscribe,
  };
}

/**
 * Aplana una entidad moviendo los campos de data al nivel superior.
 * Mantiene id, type, created_at, updated_at en su lugar original.
 * 
 * @param {Object} entity - Entidad con estructura { id, type, data, created_at, updated_at }
 * @returns {Object} Entidad aplanada con campos de data accesibles directamente
 */
function flattenEntity(entity) {
  if (!entity) return null;
  
  const { id, type, data, created_at, updated_at } = entity;
  
  return {
    id,
    type,
    ...data,
    created_at,
    updated_at,
    // Mantener acceso a data original por si se necesita
    _raw: entity,
  };
}

/**
 * Función auxiliar para obtener entidades relacionadas.
 * Útil para cargar clientes de proyectos, etc.
 * 
 * @param {string} type - Tipo de entidad a buscar
 * @param {string[]} ids - Array de UUIDs
 */
export async function getEntitiesByIds(type, ids) {
  if (!ids || ids.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("type", type)
    .in("id", ids);

  if (error) throw error;

  return {
    data: data?.map(flattenEntity) || [],
    error: null,
  };
}

/**
 * Función auxiliar para obtener una entidad relacionada por ID.
 * 
 * @param {string} type - Tipo de entidad
 * @param {string} id - UUID de la entidad
 */
export async function getEntityById(type, id) {
  if (!id) return { data: null, error: null };

  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("type", type)
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;

  return {
    data: data ? flattenEntity(data) : null,
    error: null,
  };
}
