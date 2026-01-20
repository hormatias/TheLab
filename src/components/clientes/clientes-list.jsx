import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2, AlertCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function ClientesList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadClientes();
  }, []);

  async function loadClientes() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nombre", { ascending: true });

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error(
            `No se encontró la tabla "clientes". Por favor, crea la tabla en tu base de datos de Supabase.`
          );
        }
        throw error;
      }

      setClientes(data || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createCliente(e) {
    e.preventDefault();
    if (!nombreCliente.trim()) return;

    try {
      setCreating(true);
      const { data, error } = await supabase
        .from("clientes")
        .insert([{ nombre: nombreCliente.trim() }])
        .select()
        .single();

      if (error) throw error;

      setClientes([...clientes, data].sort((a, b) => 
        (a.nombre || "").localeCompare(b.nombre || "")
      ));
      setNombreCliente("");
      setShowForm(false);
    } catch (err) {
      console.error("Error al crear cliente:", err);
      alert(`Error al crear cliente: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  const handleDeleteClick = (id, nombre) => {
    setConfirmDelete({ id, nombre });
  };

  const confirmDeleteCliente = async () => {
    if (!confirmDelete) {
      setConfirmDelete(null);
      return;
    }

    const { id } = confirmDelete;

    try {
      setDeleting(id);
      setConfirmDelete(null);
      
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setClientes(clientes.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Error al eliminar cliente:", err);
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
          <span className="ml-2 text-muted-foreground">Cargando clientes...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isTableNotFound = error.includes("No se encontró") || 
                           error.includes("schema cache") ||
                           error.includes("PGRST116");
    
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
                  Crea la tabla "clientes" en tu base de datos de Supabase con los campos: id (UUID) y nombre (TEXT).
                </p>
                <Button onClick={loadClientes} className="mt-4" variant="outline">
                  Reintentar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar clientes</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadClientes} className="mt-4" variant="outline">
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
          <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
          <p className="text-muted-foreground">
            {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadClientes} 
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
            title="Nuevo Cliente"
          >
            <Plus className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Nuevo Cliente"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Cliente</CardTitle>
            <CardDescription>
              Ingresa el nombre del cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createCliente} className="space-y-4">
              <div>
                <label htmlFor="nombre" className="text-sm font-medium">
                  Nombre del Cliente
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  placeholder="Mi Cliente"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                  disabled={creating}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={creating || !nombreCliente.trim()}
                  size={isMobile ? "icon" : "default"}
                  title={isMobile ? "Crear Cliente" : undefined}
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
                        "Crear Cliente"
                      )}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setNombreCliente("");
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

      {clientes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay clientes</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crea tu primer cliente para comenzar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clientes.map((cliente) => (
            <Card 
              key={cliente.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/clientes/${cliente.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-1 flex-1 pr-2">
                    {cliente.nombre || cliente.name || cliente.title || "Sin nombre"}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteClick(cliente.id, cliente.nombre);
                    }}
                    disabled={deleting === cliente.id}
                    aria-label="Eliminar cliente"
                  >
                    {deleting === cliente.id ? (
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

      <ConfirmDialog
        open={!!confirmDelete}
        onConfirm={confirmDeleteCliente}
        onCancel={() => setConfirmDelete(null)}
        title="Eliminar Cliente"
        message={`¿Estás seguro de que quieres eliminar el cliente "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
