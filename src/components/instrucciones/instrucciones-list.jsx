import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyNote, Loader2, AlertCircle, Plus, Trash2, Mic, Square, Clock } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

/** Fecha local como YYYY-MM-DD para comparar solo día. */
function toDateKey(d) {
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Lunes 00:00:00 de la semana de la fecha dada (semana lun–dom). */
function getStartOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

/**
 * Agrupa instrucciones por franjas temporales (hoy, ayer, esta semana, este mes, anteriores).
 * Usa fecha local y updated_at (o created_at). La lista debe venir ordenada por updated_at desc.
 */
function groupInstruccionesByDate(instrucciones) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);
  const startOfWeekKey = toDateKey(getStartOfWeek(now));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthKey = toDateKey(startOfMonth);

  const groups = { hoy: [], ayer: [], estaSemana: [], esteMes: [], anteriores: [] };
  for (const inst of instrucciones) {
    const date = new Date(inst.updated_at || inst.created_at || 0);
    const key = toDateKey(date);
    if (key === todayKey) groups.hoy.push(inst);
    else if (key === yesterdayKey) groups.ayer.push(inst);
    else if (key >= startOfWeekKey && key < todayKey) groups.estaSemana.push(inst);
    else if (key >= startOfMonthKey && key < startOfWeekKey) groups.esteMes.push(inst);
    else groups.anteriores.push(inst);
  }
  return groups;
}

const SECTION_LABELS = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "estaSemana", label: "Esta semana" },
  { key: "esteMes", label: "Este mes" },
  { key: "anteriores", label: "Anteriores" },
];

export function InstruccionesList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [instrucciones, setInstrucciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const userClosedFormRef = useRef(false);
  const pullStartRef = useRef({ y: 0, scrollY: 0 });
  /** "form" = rellenar título/descripcion; "newNote" = crear instrucción tras transcribir */
  const recordingIntentRef = useRef("form");

  const instruccionesApi = useEntities("instruccion");

  useEffect(() => {
    loadInstrucciones();
  }, []);

  // Pull-to-refresh: al soltar tras arrastrar hacia abajo desde el top, recargar
  useEffect(() => {
    const PULL_THRESHOLD = 80;
    function onTouchStart(e) {
      if (e.touches.length === 0) return;
      pullStartRef.current = { y: e.touches[0].clientY, scrollY: window.scrollY };
    }
    function onTouchEnd(e) {
      if (e.changedTouches.length === 0) return;
      const { y: startY, scrollY: startScrollY } = pullStartRef.current;
      const endY = e.changedTouches[0].clientY;
      if (startScrollY === 0 && startY - endY >= PULL_THRESHOLD) {
        loadInstrucciones();
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  async function loadInstrucciones() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await instruccionesApi.list({ orderBy: "updated_at", ascending: false });
      setInstrucciones(data || []);
    } catch (err) {
      console.error("Error al cargar instrucciones:", err);
      if (err.code === "PGRST116" || err.message?.includes("entities")) {
        setError("No se encontró la tabla 'entities'. Por favor, ejecuta la migración 013_create_entities_table.sql");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createInstruccion(e) {
    e.preventDefault();
    if (!titulo.trim()) return;

    try {
      setCreating(true);
      const { data } = await instruccionesApi.create({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
      });
      setInstrucciones([...instrucciones, data].sort((a, b) =>
        new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
      ));
      setTitulo("");
      setDescripcion("");
      userClosedFormRef.current = false;
      setShowForm(false);
    } catch (err) {
      console.error("Error al crear instrucción:", err);
      alert(`Error al crear instrucción: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Safari/WebKit (iOS) no soporta audio/webm; usar audio/mp4 para que la grabación funcione
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      }
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
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
          const suggestedTitle = data?.title?.trim();
          const intent = recordingIntentRef.current;

          if (intent === "newNote") {
            try {
              const { data: newInst } = await instruccionesApi.create({
                titulo: suggestedTitle || "Nota de voz",
                descripcion: text || null,
              });
              setInstrucciones((prev) =>
                [newInst, ...prev].sort(
                  (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
                )
              );
            } catch (createErr) {
              console.error("Error al crear instrucción:", createErr);
              alert(`Error al crear la nota: ${createErr.message}`);
            }
            recordingIntentRef.current = "form";
          } else {
            if (text) {
              setDescripcion((prev) => (prev ? prev + "\n\n" + text : text));
              if (suggestedTitle) setTitulo((prev) => (prev.trim() ? prev : suggestedTitle));
            }
            if (!text && data?.error) throw new Error(data.error);
          }
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

  const handleDeleteClick = (id, tituloInstruccion) => {
    setConfirmDelete({ id, titulo: tituloInstruccion });
  };

  const confirmDeleteInstruccion = async () => {
    if (!confirmDelete) {
      setConfirmDelete(null);
      return;
    }
    const { id } = confirmDelete;
    try {
      setDeleting(id);
      setConfirmDelete(null);
      await instruccionesApi.remove(id);
      setInstrucciones(instrucciones.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Error al eliminar instrucción:", err);
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
          <span className="ml-2 text-muted-foreground">Cargando instrucciones...</span>
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
                <Button onClick={loadInstrucciones} className="mt-4" variant="outline">
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
              <p className="font-medium">Error al cargar instrucciones</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadInstrucciones} className="mt-4" variant="outline">
                Reintentar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Vista solo formulario al crear instrucción: sin título "Instrucciones", sin lista ni botones
  if (showForm) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={createInstruccion} className="space-y-4">
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
                  required
                  disabled={creating}
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="descripcion" className="text-sm font-medium">
                    Descripción (opcional)
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      if (recording) stopRecording();
                      else {
                        recordingIntentRef.current = "form";
                        startRecording();
                      }
                    }}
                    disabled={creating || transcribing}
                    title={recording ? "Parar grabación" : transcribing ? "Transcribiendo..." : "Grabar con voz"}
                    aria-label={recording ? "Parar grabación" : "Grabar con voz"}
                  >
                    {transcribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : recording ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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
                  title={isMobile ? "Crear Instrucción" : undefined}
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
                        "Crear Instrucción"
                      )}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
userClosedFormRef.current = true;
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
      </div>
    );
  }

  const groups = groupInstruccionesByDate(instrucciones);

  function renderInstructionCard(instruccion) {
    return (
      <Card
        key={instruccion.id}
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => navigate(`/instrucciones/${instruccion.id}`)}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 pr-2 min-w-0">
              <CardTitle className="line-clamp-1">
                {instruccion.titulo || "Sin título"}
              </CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {preview(instruccion.descripcion ?? instruccion.contenido)}
              </CardDescription>
              {(instruccion.updated_at || instruccion.created_at) && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {new Date(instruccion.updated_at || instruccion.created_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
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
                handleDeleteClick(instruccion.id, instruccion.titulo);
              }}
              disabled={deleting === instruccion.id}
              aria-label="Eliminar instrucción"
            >
              {deleting === instruccion.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex gap-4 min-h-[140px] w-full md:col-span-2 lg:col-span-3 md:justify-center">
          <Card
            className="flex-1 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-center items-center p-4 min-h-[120px]"
            onClick={(e) => {
              e.stopPropagation();
              setShowForm(true);
            }}
          >
            <Plus className="h-8 w-8 text-muted-foreground mb-1.5" aria-hidden />
            <span className="text-sm font-medium">Escribir</span>
          </Card>
          <Card
            className={cn(
              "flex-1 transition-shadow flex flex-col justify-center items-center p-4 min-h-[120px]",
              recording || transcribing ? "bg-muted/50" : "hover:shadow-md cursor-pointer",
              transcribing && "pointer-events-none"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (recording) {
                stopRecording();
                return;
              }
              if (transcribing) return;
              recordingIntentRef.current = "newNote";
              startRecording();
            }}
            aria-disabled={transcribing}
          >
            {transcribing ? (
              <>
                <Loader2 className="h-8 w-8 text-muted-foreground mb-1.5 animate-spin" aria-hidden />
                <span className="text-sm font-medium">Transcribiendo…</span>
              </>
            ) : recording ? (
              <>
                <Square className="h-8 w-8 text-muted-foreground mb-1.5" aria-hidden />
                <span className="text-sm font-medium">Toca para parar</span>
              </>
            ) : (
              <>
                <Mic className="h-8 w-8 text-muted-foreground mb-1.5" aria-hidden />
                <span className="text-sm font-medium">Grabar nota</span>
              </>
            )}
          </Card>
        </div>
      </div>

      {instrucciones.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <StickyNote className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay instrucciones</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crea tu primera instrucción para comenzar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {SECTION_LABELS.map(({ key, label }) => {
            const list = groups[key];
            if (!list || list.length === 0) return null;
            const n = list.length;
            const text = n === 1 ? "1 instrucción" : `${n} instrucciones`;
            return (
              <section key={key}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {label} — {text}
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {list.map((instruccion) => renderInstructionCard(instruccion))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onConfirm={confirmDeleteInstruccion}
        onCancel={() => setConfirmDelete(null)}
        title="Eliminar Instrucción"
        message={`¿Estás seguro de que quieres eliminar la instrucción "${confirmDelete?.titulo}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
