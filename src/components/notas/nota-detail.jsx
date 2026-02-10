import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle, Save, Trash2, Pencil, Mic, Square } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function NotaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [nota, setNota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const notasApi = useEntities("nota");

  useEffect(() => {
    loadNota();
  }, [id]);

  async function loadNota() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await notasApi.get(id);
      if (!data) {
        throw new Error("Nota no encontrada");
      }
      setNota(data);
      setTitulo(data.titulo || "");
      setDescripcion(data.descripcion ?? data.contenido ?? "");
    } catch (err) {
      console.error("Error al cargar nota:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!titulo.trim()) return;
    const currentDesc = nota?.descripcion ?? nota?.contenido ?? "";
    if (titulo === nota?.titulo && descripcion === currentDesc) return;

    try {
      setSaving(true);
      await notasApi.update(id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
      });
      setNota({ ...nota, titulo: titulo.trim(), descripcion: descripcion.trim() || null });
      setIsEditing(false);
    } catch (err) {
      console.error("Error al guardar nota:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setTitulo(nota?.titulo ?? "");
    setDescripcion(nota?.descripcion ?? nota?.contenido ?? "");
    setIsEditing(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (chunks.length === 0) {
          setRecording(false);
          return;
        }
        const blob = new Blob(chunks, { type: mimeType });
        setTranscribing(true);
        try {
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result;
              resolve(dataUrl ? String(dataUrl).split(",")[1] ?? "" : "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
          const response = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
              "apikey": supabaseKey,
            },
            body: JSON.stringify({ audio: base64, contentType: mimeType }),
          });
          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Error ${response.status}`);
          }
          const data = await response.json();
          const text = data?.text ?? "";
          if (text) {
            setDescripcion((prev) => (prev ? prev + "\n\n" + text : text));
            setIsEditing(true);
          }
          if (!text && data?.error) throw new Error(data.error);
        } catch (err) {
          console.error("Error al transcribir:", err);
          alert(`Error al transcribir: ${err.message}`);
        } finally {
          setTranscribing(false);
          setRecording(false);
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      if (err.name === "NotAllowedError") {
        alert("Se ha denegado el acceso al micrófono. Permite el permiso para grabar.");
      } else {
        alert(`Error al grabar: ${err.message}`);
      }
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }

  async function handleDelete() {
    try {
      setConfirmDelete(false);
      await notasApi.remove(id);
      navigate("/notas");
    } catch (err) {
      console.error("Error al eliminar nota:", err);
      alert(`Error: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando nota...</span>
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
              <p className="font-medium">Error al cargar nota</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <div className="flex gap-2 justify-center mt-4">
                <Button onClick={() => navigate("/notas")} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver
                </Button>
                <Button onClick={loadNota} variant="outline">
                  Reintentar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentDesc = nota?.descripcion ?? nota?.contenido ?? "";
  const hasChanges = titulo !== (nota?.titulo ?? "") || descripcion !== currentDesc;

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Barra: volver | título | editar */}
      <div className="flex items-center gap-2 sm:gap-4 w-full">
        <Button
          onClick={() => navigate("/notas")}
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="w-0 flex-1 min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight truncate" title={nota?.titulo}>
            {nota?.titulo || "Nota"}
          </h2>
        </div>
        {!isEditing ? (
          <Button
            variant="outline"
            size={isMobile ? "icon" : "sm"}
            onClick={() => setIsEditing(true)}
            title="Editar nota"
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
            <CardTitle>Editar nota</CardTitle>
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
                placeholder="Título de la nota"
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
                title="Eliminar nota"
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
              title="Eliminar nota"
            >
              Eliminar
            </Button>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 flex-shrink-0" />
            <span>{isMobile ? "Grabar y transcribir" : "Grabar y transcribir con Whisper"}</span>
          </CardTitle>
          <CardDescription>
            Graba con el micrófono; el audio se transcribe y se añade a la descripción. Luego puedes editar y guardar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recording ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Grabando...</span>
              <Button type="button" variant="outline" size="sm" onClick={stopRecording} title="Detener">
                <Square className="h-4 w-4 mr-2 fill-current" />
                Detener
              </Button>
            </div>
          ) : transcribing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribiendo...
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={startRecording} disabled={transcribing} title="Grabar y transcribir">
              <Mic className="h-4 w-4 mr-2" />
              Grabar
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        title="Eliminar Nota"
        message={`¿Estás seguro de que quieres eliminar la nota "${nota?.titulo}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
