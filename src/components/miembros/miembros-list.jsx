import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Loader2, AlertCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function MiembrosList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [nombreMiembro, setNombreMiembro] = useState("");
  const [emailMiembro, setEmailMiembro] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const miembrosApi = useEntities("miembro");

  useEffect(() => {
    loadMiembros();
  }, []);

  useEffect(() => {
    // Mostrar formulario automáticamente si no hay miembros
    if (!loading && miembros.length === 0 && !showForm) {
      setShowForm(true);
    }
  }, [loading, miembros.length]);

  async function loadMiembros() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await miembrosApi.list({ orderBy: "nombre", ascending: true });
      setMiembros(data || []);
    } catch (err) {
      console.error("Error al cargar miembros:", err);
      setError(err.message || "Error al cargar miembros");
    } finally {
      setLoading(false);
    }
  }

  async function createMiembro(e) {
    e.preventDefault();
    if (!nombreMiembro.trim()) return;

    try {
      setCreating(true);
      const miembroData = {
        nombre: nombreMiembro.trim(),
        ...(emailMiembro.trim() && { email: emailMiembro.trim() })
      };

      const { data } = await miembrosApi.create(miembroData);

      setMiembros([...miembros, data].sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "")
      ));
      setNombreMiembro("");
      setEmailMiembro("");
      setShowForm(false);
    } catch (err) {
      console.error("Error al crear miembro:", err);
      alert(`Error al crear miembro: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  const handleDeleteClick = (id, nombre) => {
    setConfirmDelete({ id, nombre });
  };

  const confirmDeleteMiembro = async () => {
    if (!confirmDelete) {
      setConfirmDelete(null);
      return;
    }

    const { id } = confirmDelete;

    try {
      setDeleting(id);
      setConfirmDelete(null);

      await miembrosApi.remove(id);

      setMiembros(miembros.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Error al eliminar miembro:", err);
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
          <span className="ml-2 text-muted-foreground">Cargando miembros...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isTableNotFound = error.includes("No se encontró") ||
      error.includes("schema cache") ||
      error.includes("PGRST116") ||
      error.includes("entities");

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
                  Ejecuta la migración para crear la tabla "entities" en tu base de datos de Supabase.
                </p>
                <Button onClick={loadMiembros} className="mt-4" variant="outline">
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
              <p className="font-medium">Error al cargar miembros</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadMiembros} className="mt-4" variant="outline">
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
          <h2 className="text-3xl font-bold tracking-tight">Miembros</h2>
          <p className="text-muted-foreground">
            {miembros.length} {miembros.length === 1 ? "miembro" : "miembros"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadMiembros}
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
            title="Nuevo Miembro"
          >
            <Plus className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Nuevo Miembro"}
          </Button>
        </div>
      </div>

      {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Crear Nuevo Miembro</CardTitle>
                <CardDescription>
                  Ingresa los datos del miembro
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createMiembro} className="space-y-4">
                  <div>
                    <label htmlFor="nombre" className="text-sm font-medium">
                      Nombre del Miembro
                    </label>
                    <input
                      id="nombre"
                      type="text"
                      value={nombreMiembro}
                      onChange={(e) => setNombreMiembro(e.target.value)}
                      placeholder="Juan Pérez"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      required
                      disabled={creating}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="text-sm font-medium">
                      Email (opcional)
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={emailMiembro}
                      onChange={(e) => setEmailMiembro(e.target.value)}
                      placeholder="juan@ejemplo.com"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={creating}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={creating || !nombreMiembro.trim()}
                      size={isMobile ? "icon" : "default"}
                      title={isMobile ? "Crear Miembro" : undefined}
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
                            "Crear Miembro"
                          )}
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowForm(false);
                        setNombreMiembro("");
                        setEmailMiembro("");
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

      {miembros.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <User className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay miembros</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crea tu primer miembro para comenzar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : miembros.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {miembros.map((miembro) => (
            <Card
              key={miembro.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/miembros/${miembro.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 pr-2">
                    <CardTitle className="line-clamp-1">
                      {miembro.nombre || "Sin nombre"}
                    </CardTitle>
                    {miembro.email && (
                      <CardDescription className="mt-1 line-clamp-1">
                        {miembro.email}
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
                      handleDeleteClick(miembro.id, miembro.nombre);
                    }}
                    disabled={deleting === miembro.id}
                    aria-label="Eliminar miembro"
                  >
                    {deleting === miembro.id ? (
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
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        onConfirm={confirmDeleteMiembro}
        onCancel={() => setConfirmDelete(null)}
        title="Eliminar Miembro"
        message={`¿Estás seguro de que quieres eliminar el miembro "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
