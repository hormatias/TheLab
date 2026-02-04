import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, AlertCircle, Plus, Trash2, RefreshCw, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function FormulariosList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [nombreFormulario, setNombreFormulario] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const formulariosApi = useEntities("formulario");

  useEffect(() => {
    loadFormularios();
  }, []);

  useEffect(() => {
    // Mostrar formulario automáticamente si no hay formularios
    if (!loading && formularios.length === 0 && !showForm) {
      setShowForm(true);
    }
  }, [loading, formularios.length]);

  async function loadFormularios() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await formulariosApi.list({ orderBy: "nombre", ascending: true });
      setFormularios(data || []);
    } catch (err) {
      console.error("Error al cargar formularios:", err);
      if (err.code === "PGRST116" || err.message?.includes("entities")) {
        setError("No se encontró la tabla 'entities'. Por favor, ejecuta la migración 013_create_entities_table.sql");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createFormulario(e) {
    e.preventDefault();
    if (!nombreFormulario.trim()) return;

    try {
      setCreating(true);
      let pdfPath = null;

      // Subir PDF si existe
      if (pdfFile) {
        const fileExt = pdfFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("formularios")
          .upload(fileName, pdfFile);

        if (uploadError) {
          throw new Error(`Error al subir PDF: ${uploadError.message}`);
        }

        pdfPath = fileName;
      }

      const formularioData = {
        nombre: nombreFormulario.trim(),
        pdf_path: pdfPath,
      };

      const { data } = await formulariosApi.create(formularioData);

      setFormularios([...formularios, data].sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "")
      ));
      setNombreFormulario("");
      setPdfFile(null);
      setShowForm(false);
    } catch (err) {
      console.error("Error al crear formulario:", err);
      alert(`Error al crear formulario: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  const handleDeleteClick = (id, nombre) => {
    setConfirmDelete({ id, nombre });
  };

  const confirmDeleteFormulario = async () => {
    if (!confirmDelete) {
      setConfirmDelete(null);
      return;
    }

    const { id } = confirmDelete;
    const formulario = formularios.find((f) => f.id === id);

    try {
      setDeleting(id);
      setConfirmDelete(null);

      // Eliminar PDF del storage si existe
      if (formulario?.pdf_path) {
        await supabase.storage
          .from("formularios")
          .remove([formulario.pdf_path]);
      }

      await formulariosApi.remove(id);

      setFormularios(formularios.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Error al eliminar formulario:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else if (file) {
      alert("Por favor selecciona un archivo PDF");
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando formularios...</span>
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
                <Button onClick={loadFormularios} className="mt-4" variant="outline">
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
              <p className="font-medium">Error al cargar formularios</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadFormularios} className="mt-4" variant="outline">
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
          <h2 className="text-3xl font-bold tracking-tight">Formularios</h2>
          <p className="text-muted-foreground">
            {formularios.length} {formularios.length === 1 ? "formulario" : "formularios"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadFormularios}
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
            title="Nuevo Formulario"
          >
            <Plus className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Nuevo Formulario"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Formulario</CardTitle>
            <CardDescription>
              Ingresa el nombre y sube un PDF (opcional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createFormulario} className="space-y-4">
              <div>
                <label htmlFor="nombre" className="text-sm font-medium">
                  Nombre del Formulario
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombreFormulario}
                  onChange={(e) => setNombreFormulario(e.target.value)}
                  placeholder="Formulario de inscripción"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                  disabled={creating}
                />
              </div>
              <div>
                <label htmlFor="pdf" className="text-sm font-medium">
                  Archivo PDF (opcional)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="pdf"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={creating}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("pdf")?.click()}
                    disabled={creating}
                    className="w-full justify-start"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {pdfFile ? pdfFile.name : "Seleccionar PDF"}
                  </Button>
                  {pdfFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPdfFile(null)}
                      disabled={creating}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={creating || !nombreFormulario.trim()}
                  size={isMobile ? "icon" : "default"}
                  title={isMobile ? "Crear Formulario" : undefined}
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
                        "Crear Formulario"
                      )}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setNombreFormulario("");
                    setPdfFile(null);
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

      {formularios.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay formularios</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crea tu primer formulario para comenzar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : formularios.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {formularios.map((formulario) => (
            <Card
              key={formulario.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/formularios/${formulario.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 pr-2">
                    <CardTitle className="line-clamp-1">
                      {formulario.nombre || "Sin nombre"}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {formulario.pdf_path ? "PDF adjunto" : "Sin PDF"}
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
                      handleDeleteClick(formulario.id, formulario.nombre);
                    }}
                    disabled={deleting === formulario.id}
                    aria-label="Eliminar formulario"
                  >
                    {deleting === formulario.id ? (
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
        onConfirm={confirmDeleteFormulario}
        onCancel={() => setConfirmDelete(null)}
        title="Eliminar Formulario"
        message={`¿Estás seguro de que quieres eliminar el formulario "${confirmDelete?.nombre}"? Esta acción no se puede deshacer y también se eliminará el PDF asociado.`}
      />
    </div>
  );
}
