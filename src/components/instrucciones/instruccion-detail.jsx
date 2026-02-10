import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle, Save, Trash2, Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function InstruccionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [instruccion, setInstruccion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const instruccionesApi = useEntities("instruccion");

  useEffect(() => {
    loadInstruccion();
  }, [id]);

  async function loadInstruccion() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await instruccionesApi.get(id);
      if (!data) {
        throw new Error("Instrucción no encontrada");
      }
      setInstruccion(data);
      setTitulo(data.titulo || "");
      setDescripcion(data.descripcion ?? data.contenido ?? "");
    } catch (err) {
      console.error("Error al cargar instrucción:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!titulo.trim()) return;
    const currentDesc = instruccion?.descripcion ?? instruccion?.contenido ?? "";
    if (titulo === instruccion?.titulo && descripcion === currentDesc) return;

    try {
      setSaving(true);
      await instruccionesApi.update(id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
      });
      setInstruccion({ ...instruccion, titulo: titulo.trim(), descripcion: descripcion.trim() || null });
      setIsEditing(false);
    } catch (err) {
      console.error("Error al guardar instrucción:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setTitulo(instruccion?.titulo ?? "");
    setDescripcion(instruccion?.descripcion ?? instruccion?.contenido ?? "");
    setIsEditing(false);
  }

  async function handleDelete() {
    try {
      setConfirmDelete(false);
      await instruccionesApi.remove(id);
      navigate("/instrucciones");
    } catch (err) {
      console.error("Error al eliminar instrucción:", err);
      alert(`Error: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando instrucción...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar instrucción</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => navigate("/instrucciones")} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
                <Button onClick={loadInstruccion} variant="outline">
                  Reintentar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentDesc = instruccion?.descripcion ?? instruccion?.contenido ?? "";
  const hasChanges = titulo !== (instruccion?.titulo ?? "") || descripcion !== currentDesc;

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Barra: volver | título | editar */}
      <div className="flex items-center gap-2 sm:gap-4 w-full">
        <Button
          onClick={() => navigate("/instrucciones")}
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="w-0 flex-1 min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight truncate" title={instruccion?.titulo}>
            {instruccion?.titulo || "Instrucción"}
          </h2>
        </div>
        {!isEditing ? (
          <Button
            variant="outline"
            size={isMobile ? "icon" : "sm"}
            onClick={() => setIsEditing(true)}
            title="Editar instrucción"
            className="flex-shrink-0"
          >
            <Pencil className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Editar"}
          </Button>
        ) : null}
      </div>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Editar instrucción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="titulo" className="text-sm font-medium">
                Título
              </label>
              <input
                id="titulo"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título de la instrucción"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="descripcion" className="text-sm font-medium">
                Descripción (Markdown)
              </label>
              <textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Escribe la descripción en Markdown. Ej: **negrita**, listas con -, [enlace](url)..."
                rows={12}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[200px] font-mono text-sm"
                disabled={saving}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={save}
                disabled={saving || !titulo.trim() || !hasChanges}
                size={isMobile ? "icon" : "default"}
                title={isMobile ? "Guardar" : undefined}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className={cn("h-4 w-4", !isMobile && "mr-2")} />
                    {!isMobile && "Guardar"}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={cancelEdit}
                disabled={saving}
                size={isMobile ? "icon" : "default"}
                title="Cancelar"
              >
                {!isMobile && "Cancelar"}
              </Button>
              <Button
                variant="outline"
                size={isMobile ? "icon" : "default"}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
                title="Eliminar instrucción"
              >
                <Trash2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                {!isMobile && "Eliminar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Vista: solo la descripción renderizada */}
          <div className="min-h-[120px]">
            {descripcion?.trim() ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {descripcion}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-muted-foreground italic">Sin descripción</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
              title="Eliminar instrucción"
            >
              Eliminar
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        title="Eliminar Instrucción"
        message={`¿Estás seguro de que quieres eliminar la instrucción "${instruccion?.titulo}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
