import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2, AlertCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function ProyectosList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [nombreProyecto, setNombreProyecto] = useState("");
  const [descripcionProyecto, setDescripcionProyecto] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [tableName, setTableName] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadProyectos();
    loadClientes();
  }, []);

  async function loadClientes() {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error al cargar clientes:", error);
        return;
      }

      setClientes(data || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  }

  async function loadProyectos() {
    try {
      setLoading(true);
      setError(null);

      const table = "proyectos";
      setTableName(table);

      const { data, error } = await supabase
        .from(table)
        .select(`
          *,
          clientes (
            id,
            nombre
          )
        `)
        .order("nombre", { ascending: true });

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error(
            `No se encontró la tabla "proyectos". Por favor, crea la tabla en tu base de datos de Supabase.`
          );
        }
        throw error;
      }

      setProyectos(data || []);
    } catch (err) {
      console.error("Error al cargar proyectos:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createProyecto(e) {
    e.preventDefault();
    if (!nombreProyecto.trim() || !tableName) return;

    try {
      setCreating(true);
      const proyectoData = {
        nombre: nombreProyecto.trim(),
        ...(clienteId && { cliente_id: clienteId }),
        ...(descripcionProyecto.trim() && { descripcion: descripcionProyecto.trim() })
      };

      const { data, error } = await supabase
        .from(tableName)
        .insert([proyectoData])
        .select(`
          *,
          clientes (
            id,
            nombre
          )
        `)
        .single();

      if (error) throw error;

      setProyectos([...proyectos, data].sort((a, b) => 
        (a.nombre || "").localeCompare(b.nombre || "")
      ));
      setNombreProyecto("");
      setDescripcionProyecto("");
      setClienteId("");
      setShowForm(false);
    } catch (err) {
      console.error("Error al crear proyecto:", err);
      alert(`Error al crear proyecto: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  const handleDeleteClick = (id, nombre) => {
    setConfirmDelete({ id, nombre });
  };

  const confirmDeleteProyecto = async () => {
    if (!confirmDelete || !tableName) {
      setConfirmDelete(null);
      return;
    }

    const { id } = confirmDelete;

    try {
      setDeleting(id);
      setConfirmDelete(null);
      
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);

      if (error) throw error;

      setProyectos(proyectos.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error al eliminar proyecto:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando proyectos...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isTableNotFound = error.includes("No se encontró ninguna tabla") || 
                           error.includes("schema cache") ||
                           error.includes("PGRST116");
    
    // Si la tabla no existe, mostrar mensaje
    if (isTableNotFound) {
      return (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="text-center max-w-md">
                <p className="font-medium">Tabla no encontrada</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <p className="text-sm text-muted-foreground mt-4">
                  Crea la tabla "proyectos" en tu base de datos de Supabase con los campos: id (UUID) y nombre (TEXT).
                </p>
                <Button onClick={loadProyectos} className="mt-4" variant="outline">
                  Reintentar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Otros errores
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar proyectos</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadProyectos} className="mt-4" variant="outline">
                Reintentar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Proyectos</h2>
          <p className="text-muted-foreground">
            {proyectos.length} {proyectos.length === 1 ? "proyecto" : "proyectos"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadProyectos} 
            variant="outline" 
            size={isMobile ? "icon" : "sm"}
            title="Actualizar"
          >
            <RefreshCw className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Actualizar"}
          </Button>
          <Button 
            onClick={() => setShowForm(!showForm)} 
            size={isMobile ? "icon" : "sm"}
            title="Nuevo Proyecto"
          >
            <Plus className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Nuevo Proyecto"}
          </Button>
        </div>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Proyecto</CardTitle>
            <CardDescription>
              Ingresa los datos del proyecto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createProyecto} className="space-y-4">
              <div>
                <label htmlFor="nombre" className="text-sm font-medium">
                  Nombre del Proyecto
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombreProyecto}
                  onChange={(e) => setNombreProyecto(e.target.value)}
                  placeholder="Mi Proyecto"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                  disabled={creating}
                />
              </div>
              <div>
                <label htmlFor="descripcion" className="text-sm font-medium">
                  Descripción (opcional, Markdown)
                </label>
                <textarea
                  id="descripcion"
                  value={descripcionProyecto}
                  onChange={(e) => setDescripcionProyecto(e.target.value)}
                  placeholder="Escribe una descripción en formato Markdown..."
                  rows={6}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Puedes usar Markdown para formatear el texto
                </p>
              </div>
              <div>
                <label htmlFor="cliente" className="text-sm font-medium">
                  Cliente (opcional)
                </label>
                <select
                  id="cliente"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={creating}
                >
                  <option value="">Sin cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={creating || !nombreProyecto.trim()}
                  size={isMobile ? "icon" : "default"}
                  title={isMobile ? "Crear Proyecto" : undefined}
                >
                  {creating ? (
                    <>
                      <Loader2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                      {!isMobile && "Creando..."}
                    </>
                  ) : (
                    <>
                      {isMobile ? (
                        <Plus className="h-4 w-4" />
                      ) : (
                        "Crear Proyecto"
                      )}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setNombreProyecto("");
                    setDescripcionProyecto("");
                    setClienteId("");
                  }}
                  disabled={creating}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de proyectos */}
      {proyectos.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay proyectos</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crea tu primer proyecto para comenzar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((proyecto) => (
            <Card 
              key={proyecto.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/proyectos/${proyecto.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 pr-2">
                    <CardTitle className="line-clamp-1">
                      {proyecto.nombre || proyecto.name || proyecto.title || "Sin nombre"}
                    </CardTitle>
                    {proyecto.clientes && (
                      <CardDescription className="mt-1">
                        Cliente: {proyecto.clientes.nombre}
                      </CardDescription>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteClick(proyecto.id, proyecto.nombre);
                    }}
                    disabled={deleting === proyecto.id}
                    aria-label="Eliminar proyecto"
                  >
                    {deleting === proyecto.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        open={!!confirmDelete}
        onConfirm={confirmDeleteProyecto}
        onCancel={() => setConfirmDelete(null)}
        title="Eliminar Proyecto"
        message={`¿Estás seguro de que quieres eliminar el proyecto "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
