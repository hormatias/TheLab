import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, User, Users, Eye, Edit2, Save, X, UserPlus, UserMinus, CheckSquare, Square, Plus, Trash2, ListTodo, Building2, Sparkles } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { queryDeepSeek } from "@/lib/deepseek";
import { AIDialog } from "@/components/ui/ai-dialog";

export function ProyectoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [proyecto, setProyecto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDescripcion, setEditingDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [miembros, setMiembros] = useState([]);
  const [todosLosMiembros, setTodosLosMiembros] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(null);
  const [todosLosClientes, setTodosLosClientes] = useState([]);
  const [showAddCliente, setShowAddCliente] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [addingCliente, setAddingCliente] = useState(false);
  const [removingCliente, setRemovingCliente] = useState(false);
  const [tareas, setTareas] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [creatingTarea, setCreatingTarea] = useState(false);
  const [updatingTarea, setUpdatingTarea] = useState(null);
  const [deletingTarea, setDeletingTarea] = useState(null);
  const [showAIResponse, setShowAIResponse] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [generandoTareas, setGenerandoTareas] = useState(false);
  const [eliminandoTodas, setEliminandoTodas] = useState(false);

  useEffect(() => {
    loadProyecto();
    loadMiembros();
    loadTodosLosMiembros();
    loadTodosLosClientes();
    loadTareas();
  }, [id]);

  async function loadProyecto() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("proyectos")
        .select(`
          *,
          clientes (
            id,
            nombre
          ),
          proyecto_miembros (
            miembros (
              id,
              nombre,
              email
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Proyecto no encontrado");
        }
        throw error;
      }

      setProyecto(data);
      setEditingDescripcion(data.descripcion || "");
      
      // Extraer miembros de la relación
      if (data.proyecto_miembros) {
        const miembrosData = data.proyecto_miembros
          .map((pm) => pm.miembros)
          .filter((m) => m !== null);
        setMiembros(miembrosData);
      }
    } catch (err) {
      console.error("Error al cargar proyecto:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMiembros() {
    try {
      const { data, error } = await supabase
        .from("proyecto_miembros")
        .select(`
          miembros (
            id,
            nombre,
            email
          )
        `)
        .eq("proyecto_id", id);

      if (!error && data) {
        const miembrosData = data
          .map((item) => item.miembros)
          .filter((m) => m !== null);
        setMiembros(miembrosData);
      }
    } catch (err) {
      console.error("Error al cargar miembros:", err);
    }
  }

  async function loadTodosLosMiembros() {
    try {
      const { data, error } = await supabase
        .from("miembros")
        .select("id, nombre, email")
        .order("nombre", { ascending: true });

      if (!error) {
        setTodosLosMiembros(data || []);
      }
    } catch (err) {
      console.error("Error al cargar todos los miembros:", err);
    }
  }

  async function loadTodosLosClientes() {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (!error) {
        setTodosLosClientes(data || []);
      }
    } catch (err) {
      console.error("Error al cargar todos los clientes:", err);
    }
  }

  async function addMiembro() {
    if (!selectedMemberId || !proyecto) return;

    try {
      setAddingMember(true);
      const { error } = await supabase
        .from("proyecto_miembros")
        .insert([{
          proyecto_id: proyecto.id,
          miembro_id: selectedMemberId
        }]);

      if (error) throw error;

      await loadMiembros();
      setSelectedMemberId("");
      setShowAddMember(false);
    } catch (err) {
      console.error("Error al agregar miembro:", err);
      alert(`Error al agregar miembro: ${err.message}`);
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMiembro(miembroId) {
    if (!proyecto) return;

    try {
      setRemovingMember(miembroId);
      const { error } = await supabase
        .from("proyecto_miembros")
        .delete()
        .eq("proyecto_id", proyecto.id)
        .eq("miembro_id", miembroId);

      if (error) throw error;

      await loadMiembros();
    } catch (err) {
      console.error("Error al remover miembro:", err);
      alert(`Error al remover miembro: ${err.message}`);
    } finally {
      setRemovingMember(null);
    }
  }

  async function addCliente() {
    if (!selectedClienteId || !proyecto) return;

    try {
      setAddingCliente(true);
      const { data, error } = await supabase
        .from("proyectos")
        .update({ cliente_id: selectedClienteId })
        .eq("id", proyecto.id)
        .select(`
          *,
          clientes (
            id,
            nombre
          )
        `)
        .single();

      if (error) throw error;

      setProyecto(data);
      setSelectedClienteId("");
      setShowAddCliente(false);
    } catch (err) {
      console.error("Error al agregar cliente:", err);
      alert(`Error al agregar cliente: ${err.message}`);
    } finally {
      setAddingCliente(false);
    }
  }

  async function removeCliente() {
    if (!proyecto) return;

    try {
      setRemovingCliente(true);
      const { data, error } = await supabase
        .from("proyectos")
        .update({ cliente_id: null })
        .eq("id", proyecto.id)
        .select(`
          *,
          clientes (
            id,
            nombre
          )
        `)
        .single();

      if (error) throw error;

      setProyecto(data);
    } catch (err) {
      console.error("Error al remover cliente:", err);
      alert(`Error al remover cliente: ${err.message}`);
    } finally {
      setRemovingCliente(false);
    }
  }

  async function updateDescripcion() {
    if (!proyecto) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from("proyectos")
        .update({ descripcion: editingDescripcion.trim() || null })
        .eq("id", proyecto.id)
        .select()
        .single();

      if (error) throw error;

      setProyecto({ ...proyecto, descripcion: data.descripcion });
      setIsEditing(false);
    } catch (err) {
      console.error("Error al actualizar descripción:", err);
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditingDescripcion(proyecto?.descripcion || "");
    setIsEditing(false);
  }

  async function loadTareas() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("tareas")
        .select("*")
        .eq("proyecto_id", id)
        .order("completada", { ascending: true })
        .order("created_at", { ascending: false });

      if (!error) {
        setTareas(data || []);
      }
    } catch (err) {
      console.error("Error al cargar tareas:", err);
    }
  }

  async function createTarea(e) {
    e.preventDefault();
    if (!nuevaTarea.trim() || !proyecto) return;

    try {
      setCreatingTarea(true);
      const { data, error } = await supabase
        .from("tareas")
        .insert([{
          proyecto_id: proyecto.id,
          nombre: nuevaTarea.trim(),
          completada: false
        }])
        .select()
        .single();

      if (error) throw error;

      setTareas([data, ...tareas]);
      setNuevaTarea("");
    } catch (err) {
      console.error("Error al crear tarea:", err);
      alert(`Error al crear tarea: ${err.message}`);
    } finally {
      setCreatingTarea(false);
    }
  }

  async function toggleTarea(tareaId, completada) {
    if (!proyecto) return;

    try {
      setUpdatingTarea(tareaId);
      const { error } = await supabase
        .from("tareas")
        .update({ completada: !completada })
        .eq("id", tareaId);

      if (error) throw error;

      setTareas(tareas.map(t => 
        t.id === tareaId ? { ...t, completada: !completada } : t
      ));
    } catch (err) {
      console.error("Error al actualizar tarea:", err);
      alert(`Error al actualizar tarea: ${err.message}`);
    } finally {
      setUpdatingTarea(null);
    }
  }

  async function deleteTarea(tareaId) {
    if (!proyecto) return;

    try {
      setDeletingTarea(tareaId);
      const { error } = await supabase
        .from("tareas")
        .delete()
        .eq("id", tareaId);

      if (error) throw error;

      setTareas(tareas.filter(t => t.id !== tareaId));
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
      alert(`Error al eliminar tarea: ${err.message}`);
    } finally {
      setDeletingTarea(null);
    }
  }

  async function eliminarTodasLasTareas() {
    if (!proyecto || tareas.length === 0) return;

    if (!confirm(`¿Estás seguro de que quieres eliminar todas las tareas (${tareas.length})?`)) {
      return;
    }

    try {
      setEliminandoTodas(true);
      const { error } = await supabase
        .from("tareas")
        .delete()
        .eq("proyecto_id", proyecto.id);

      if (error) throw error;

      setTareas([]);
    } catch (err) {
      console.error("Error al eliminar todas las tareas:", err);
      alert(`Error al eliminar tareas: ${err.message}`);
    } finally {
      setEliminandoTodas(false);
    }
  }

  async function consultarAI() {
    if (!proyecto) return;

    // Abrir el modal inmediatamente
    setShowAIResponse(true);
    setLoadingAI(true);
    setAiError(null);
    setAiResponse("");

    try {
      // Construir prompt de sistema con contexto completo
      const tareasPendientes = tareas.filter(t => !t.completada).map(t => t.nombre);
      const tareasCompletadas = tareas.filter(t => t.completada).map(t => t.nombre);
      const nombresMiembros = miembros.map(m => m.nombre);

      const systemPrompt = `Eres un asistente experto en gestión de proyectos. 
Tienes acceso a la siguiente información del proyecto:

PROYECTO: ${proyecto.nombre}
${proyecto.descripcion ? `DESCRIPCIÓN:\n${proyecto.descripcion}` : "DESCRIPCIÓN: Sin descripción"}
CLIENTE: ${proyecto.clientes ? proyecto.clientes.nombre : "Sin cliente asignado"}
MIEMBROS: ${nombresMiembros.length > 0 ? nombresMiembros.join(", ") : "Sin miembros asignados"}
TAREAS:
  - Pendientes (${tareasPendientes.length}): ${tareasPendientes.length > 0 ? tareasPendientes.join(", ") : "Ninguna"}
  - Completadas (${tareasCompletadas.length}): ${tareasCompletadas.length > 0 ? tareasCompletadas.join(", ") : "Ninguna"}

Analiza este proyecto y proporciona insights útiles, sugerencias de mejora, o cualquier información relevante que pueda ayudar en la gestión del proyecto. Responde de manera concisa y práctica.`;

      const response = await queryDeepSeek(systemPrompt);
      setAiResponse(response);
    } catch (err) {
      console.error("Error al consultar AI:", err);
      setAiError(err.message);
    } finally {
      setLoadingAI(false);
    }
  }

  function cerrarAIDialog() {
    setShowAIResponse(false);
    setAiResponse("");
    setAiError(null);
  }

  async function generarTareasConIA() {
    if (!proyecto) return;

    try {
      setGenerandoTareas(true);
      
      // Construir prompt con contexto del proyecto
      const tareasExistentes = tareas.map(t => t.nombre);
      const nombresMiembros = miembros.map(m => m.nombre);

      const systemPrompt = `Eres un asistente experto en gestión de proyectos. 
Analiza el siguiente proyecto y genera una lista de tareas necesarias para completarlo.

PROYECTO: ${proyecto.nombre}
${proyecto.descripcion ? `DESCRIPCIÓN:\n${proyecto.descripcion}` : "DESCRIPCIÓN: Sin descripción"}
CLIENTE: ${proyecto.clientes ? proyecto.clientes.nombre : "Sin cliente asignado"}
MIEMBROS: ${nombresMiembros.length > 0 ? nombresMiembros.join(", ") : "Sin miembros asignados"}
TAREAS EXISTENTES: ${tareasExistentes.length > 0 ? tareasExistentes.join(", ") : "Ninguna"}

IMPORTANTE: Responde ÚNICAMENTE con una lista de tareas, una por línea, usando el formato:
- Nombre de la tarea 1
- Nombre de la tarea 2
- Nombre de la tarea 3

No incluyas explicaciones, comentarios ni texto adicional. Solo la lista de tareas en el formato indicado.
Genera tareas específicas, accionables y relevantes para completar este proyecto.`;

      const response = await queryDeepSeek(
        systemPrompt,
        "Genera las tareas necesarias para completar este proyecto."
      );

      // Parsear la respuesta para extraer las tareas
      // Buscar líneas que empiecen con - o con números seguidos de punto
      const lineas = response.split('\n').filter(linea => linea.trim());
      const tareasGeneradas = [];

      for (const linea of lineas) {
        // Buscar patrones como "- Tarea" o "1. Tarea" o "* Tarea"
        const match = linea.match(/^[-*•]\s+(.+)$/) || linea.match(/^\d+[.)]\s+(.+)$/);
        if (match && match[1]) {
          const nombreTarea = match[1].trim();
          if (nombreTarea && nombreTarea.length > 0) {
            tareasGeneradas.push(nombreTarea);
          }
        }
      }

      // Si no se encontraron tareas con el formato esperado, intentar extraer de cualquier línea
      if (tareasGeneradas.length === 0) {
        for (const linea of lineas) {
          const limpia = linea.trim().replace(/^[-*•\d.)\s]+/, '').trim();
          if (limpia && limpia.length > 0 && limpia.length < 200) {
            tareasGeneradas.push(limpia);
          }
        }
      }

      if (tareasGeneradas.length === 0) {
        throw new Error("No se pudieron extraer tareas de la respuesta de la IA. Intenta de nuevo.");
      }

      // Crear las tareas en la base de datos
      const tareasACrear = tareasGeneradas.map(nombre => ({
        proyecto_id: proyecto.id,
        nombre: nombre.trim(),
        completada: false
      }));

      const { data, error } = await supabase
        .from("tareas")
        .insert(tareasACrear)
        .select();

      if (error) throw error;

      // Actualizar la lista de tareas
      setTareas([...tareas, ...(data || [])]);
      
      // Mostrar mensaje de éxito
      alert(`Se generaron ${tareasGeneradas.length} tareas exitosamente.`);
    } catch (err) {
      console.error("Error al generar tareas con IA:", err);
      alert(`Error al generar tareas: ${err.message}`);
    } finally {
      setGenerandoTareas(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando proyecto...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !proyecto) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar proyecto</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error || "Proyecto no encontrado"}
              </p>
              <Button onClick={() => navigate("/proyectos")} className="mt-4" variant="outline">
                Volver a Proyectos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/proyectos")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{proyecto.nombre}</h2>
            <p className="text-muted-foreground">Detalles del proyecto</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={consultarAI}
          disabled={loadingAI}
          size={isMobile ? "icon" : "default"}
          title="Consultar AI sobre este proyecto"
        >
          {loadingAI ? (
            <Loader2 className={cn("h-4 w-4 animate-spin", !isMobile && "mr-2")} />
          ) : (
            <Sparkles className={cn("h-4 w-4", !isMobile && "mr-2")} />
          )}
          {!isMobile && "Consultar AI"}
        </Button>
      </div>

      {/* Información del Proyecto - Ocupa toda la columna */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Información del Proyecto</CardTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                title="Editar descripción"
              >
                <Edit2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                {!isMobile && (proyecto.descripcion ? "Editar descripción" : "Agregar descripción")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editingDescripcion}
                  onChange={(e) => setEditingDescripcion(e.target.value)}
                  placeholder="Escribe una descripción en formato Markdown..."
                  rows={10}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y font-mono"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Puedes usar Markdown para formatear el texto
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={updateDescripcion}
                    disabled={saving}
                    size="sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : proyecto.descripcion ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {proyecto.descripcion}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="mb-3">Este proyecto no tiene descripción</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Agregar descripción
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cliente y Miembros - Grid de 2 columnas */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cliente Asociado */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cliente Asociado
              </CardTitle>
              {!showAddCliente && proyecto.clientes && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCliente(true)}
                  title="Cambiar cliente"
                >
                  <Edit2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                  {!isMobile && "Cambiar"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddCliente ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="cliente" className="text-sm font-medium">
                    Seleccionar Cliente
                  </label>
                  <select
                    id="cliente"
                    value={selectedClienteId}
                    onChange={(e) => setSelectedClienteId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={addingCliente}
                  >
                    <option value="">Selecciona un cliente</option>
                    {todosLosClientes
                      .filter((c) => !proyecto.clientes || c.id !== proyecto.clientes.id)
                      .map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={addCliente}
                    disabled={addingCliente || !selectedClienteId}
                    size="sm"
                  >
                    {addingCliente ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Agregando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Agregar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddCliente(false);
                      setSelectedClienteId("");
                    }}
                    disabled={addingCliente}
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : proyecto.clientes ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-md border border-input hover:bg-accent">
                  <div className="flex-1">
                    <p className="font-medium">{proyecto.clientes.nombre}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/clientes/${proyecto.clientes.id}`)}
                      title="Ver cliente"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeCliente}
                      disabled={removingCliente}
                      title="Remover cliente"
                      className="text-destructive hover:text-destructive"
                    >
                      {removingCliente ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="mb-3">Este proyecto no tiene cliente asignado</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCliente(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar cliente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Miembros asignados */}
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Miembros Asignados ({miembros.length})
            </CardTitle>
            {!showAddMember && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddMember(true)}
                title="Agregar miembro"
              >
                <UserPlus className={cn("h-4 w-4", !isMobile && "mr-2")} />
                {!isMobile && "Agregar Miembro"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showAddMember ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="miembro" className="text-sm font-medium">
                  Seleccionar Miembro
                </label>
                <select
                  id="miembro"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={addingMember}
                >
                  <option value="">Selecciona un miembro</option>
                  {todosLosMiembros
                    .filter((m) => !miembros.some((asignado) => asignado.id === m.id))
                    .map((miembro) => (
                      <option key={miembro.id} value={miembro.id}>
                        {miembro.nombre} {miembro.email && `(${miembro.email})`}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={addMiembro}
                  disabled={addingMember || !selectedMemberId}
                  size="sm"
                >
                  {addingMember ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Agregando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Agregar
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddMember(false);
                    setSelectedMemberId("");
                  }}
                  disabled={addingMember}
                  size="sm"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : miembros.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="mb-3">Este proyecto no tiene miembros asignados</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddMember(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar miembro
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {miembros.map((miembro) => (
                <div
                  key={miembro.id}
                  className="flex items-center justify-between p-3 rounded-md border border-input hover:bg-accent"
                >
                  <div className="flex-1">
                    <p className="font-medium">{miembro.nombre}</p>
                    {miembro.email && (
                      <p className="text-sm text-muted-foreground">{miembro.email}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/miembros/${miembro.id}`)}
                      title="Ver miembro"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMiembro(miembro.id)}
                      disabled={removingMember === miembro.id}
                      title="Remover miembro"
                      className="text-destructive hover:text-destructive"
                    >
                      {removingMember === miembro.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        </Card>
      </div>

      {/* Tareas del proyecto */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Tareas ({tareas.filter(t => !t.completada).length}/{tareas.length})
              </CardTitle>
              <Button
                variant="outline"
                onClick={generarTareasConIA}
                disabled={generandoTareas || creatingTarea}
                size="sm"
              >
                {generandoTareas ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {!isMobile && "Generando..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {!isMobile && "Generar con IA"}
                  </>
                )}
              </Button>
            </div>
            {tareas.length > 0 && (
              <Button
                variant="destructive"
                onClick={eliminarTodasLasTareas}
                disabled={eliminandoTodas}
                size="sm"
              >
                {eliminandoTodas ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {!isMobile && "Eliminando..."}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {!isMobile && "Eliminar todas"}
                    {isMobile && "Eliminar"}
                  </>
                )}
              </Button>
            )}
          </div>
          <CardDescription>
            {tareas.filter(t => t.completada).length} de {tareas.length} tareas completadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formulario para crear nueva tarea */}
          <form onSubmit={createTarea} className="flex gap-2">
            <input
              type="text"
              value={nuevaTarea}
              onChange={(e) => setNuevaTarea(e.target.value)}
              placeholder="Nueva tarea..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={creatingTarea || generandoTareas}
              required
            />
            <Button
              type="submit"
              disabled={creatingTarea || !nuevaTarea.trim() || generandoTareas}
              size="sm"
            >
              {creatingTarea ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </form>

          {/* Lista de tareas */}
          {tareas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay tareas</p>
              <p className="text-sm mt-1">Agrega tu primera tarea arriba</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tareas.map((tarea) => (
                <div
                  key={tarea.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-md border border-input hover:bg-accent transition-colors",
                    tarea.completada && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleTarea(tarea.id, tarea.completada)}
                    disabled={updatingTarea === tarea.id}
                    className="shrink-0"
                    title={tarea.completada ? "Marcar como pendiente" : "Marcar como completada"}
                  >
                    {updatingTarea === tarea.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : tarea.completada ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      tarea.completada && "line-through text-muted-foreground"
                    )}
                  >
                    {tarea.nombre}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTarea(tarea.id)}
                    disabled={deletingTarea === tarea.id || eliminandoTodas}
                    className="shrink-0 text-destructive hover:text-destructive"
                    title="Eliminar tarea"
                  >
                    {deletingTarea === tarea.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de respuesta de AI */}
      <AIDialog
        open={showAIResponse}
        onClose={cerrarAIDialog}
        loading={loadingAI}
        error={aiError}
        response={aiResponse}
        onRetry={consultarAI}
      />
    </div>
  );
}
