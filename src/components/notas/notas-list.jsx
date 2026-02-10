import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyNote, Loader2, AlertCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function NotasList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const notasApi = useEntities("nota");

  useEffect(() => {
    loadNotas();
  }, []);

  useEffect(() => {
    if (!loading && notas.length === 0 && !showForm) {
      setShowForm(true);
    }
  }, [loading, notas.length, showForm]);

  async function loadNotas() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await notasApi.list({ orderBy: "titulo", ascending: true });
      setNotas(data || []);
    } catch (err) {
      console.error("Error al cargar notas:", err);
      if (err.code === "PGRST116" || err.message?.includes("entities")) {
        setError("No se encontró la tabla 'entities'. Por favor, ejecuta la migración 013_create_entities_table.sql");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createNota(e) {
    e.preventDefault();
    if (!titulo.trim()) return;

    try {
      setCreating(true);
      const { data } = await notasApi.create({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
      });
      setNotas([...notas, data].sort((a, b) =>
        (a.titulo || "").localeCompare(b.titulo || "")
      ));
      setTitulo("");
      setDescripcion("");
      setShowForm(false);
    } catch (err) {
      console.error("Error al crear nota:", err);
      alert(`Error al crear nota: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  const handleDeleteClick = (id, tituloNota) => {
    setConfirmDelete({ id, titulo: tituloNota });
  };

  const confirmDeleteNota = async () => {
    if (!confirmDelete) {
      setConfirmDelete(null);
      return;
    }
    const { id } = confirmDelete;
    try {
      setDeleting(id);
      setConfirmDelete(null);
      await notasApi.remove(id);
      setNotas(notas.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Error al eliminar nota:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  function preview(descripcionStr) {
    if (!descripcionStr) return "Sin descripción";
    const firstLine = descripcionStr.split("\n")[0];
    return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando notas...</span>
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
                <Button onClick={loadNotas} className="mt-4" variant="outline">
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
              <p className="font-medium">Error al cargar notas</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadNotas} className="mt-4" variant="outline">
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
          <h2 className="text-3xl font-bold tracking-tight">Notas</h2>
          <p className="text-muted-foreground">
            {notas.length} {notas.length === 1 ? "nota" : "notas"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadNotas}
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
            title="Nueva Nota"
          >
            <Plus className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Nueva Nota"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nueva Nota</CardTitle>
            <CardDescription>
              Título obligatorio; la descripción es opcional y admite Markdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createNota} className="space-y-4">
              <div>
                <label htmlFor="titulo" className="text-sm font-medium">
                  Título
                </label>
                <input
                  id="titulo"
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título de la nota"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                  disabled={creating}
                />
              </div>
              <div>
                <label htmlFor="descripcion" className="text-sm font-medium">
                  Descripción (opcional)
                </label>
                <textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Escribe la descripción..."
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[80px]"
                  disabled={creating}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={creating || !titulo.trim()}
                  size={isMobile ? "icon" : "default"}
                  title={isMobile ? "Crear Nota" : undefined}
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
                        "Crear Nota"
                      )}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setTitulo("");
                    setDescripcion("");
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

      {notas.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <StickyNote className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay notas</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crea tu primera nota para comenzar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : notas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notas.map((nota) => (
            <Card
              key={nota.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/notas/${nota.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 pr-2 min-w-0">
                    <CardTitle className="line-clamp-1">
                      {nota.titulo || "Sin título"}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {preview(nota.descripcion ?? nota.contenido)}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteClick(nota.id, nota.titulo);
                    }}
                    disabled={deleting === nota.id}
                    aria-label="Eliminar nota"
                  >
                    {deleting === nota.id ? (
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
        onConfirm={confirmDeleteNota}
        onCancel={() => setConfirmDelete(null)}
        title="Eliminar Nota"
        message={`¿Estás seguro de que quieres eliminar la nota "${confirmDelete?.titulo}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
