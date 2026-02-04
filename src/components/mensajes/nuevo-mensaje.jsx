import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMessages } from "@/hooks/use-messages";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, Send } from "lucide-react";

export function NuevoMensaje() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [miembros, setMiembros] = useState([]);
  const [currentMiembro, setCurrentMiembro] = useState(null);
  const [recipientId, setRecipientId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const messagesApi = useMessages();
  const miembrosApi = useEntities("miembro");

  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");

  useEffect(() => {
    loadMiembros();
  }, []);

  async function loadMiembros() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await miembrosApi.list({});
      setMiembros(data);

      if (fromParam) {
        const from = data.find((m) => m.id === fromParam);
        if (from) setCurrentMiembro(from);
        else throw new Error("No se encontró el miembro remitente");
      } else {
        throw new Error("No se especificó el miembro remitente");
      }

      if (toParam) setRecipientId(toParam);
    } catch (err) {
      console.error("Error al cargar miembros:", err);
      setError(err.message || "Error al cargar miembros");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!recipientId || !content.trim() || !currentMiembro) return;
    try {
      setSending(true);
      await messagesApi.send(currentMiembro.id, recipientId, content.trim());
      navigate(`/mensajes/${recipientId}?from=${currentMiembro.id}`);
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      alert(`Error al enviar: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  function handleBack() {
    if (fromParam) navigate(`/miembros/${fromParam}`);
    else navigate("/mensajes");
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !currentMiembro) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error || "No se especificó el remitente"}
              </p>
              <Button onClick={handleBack} className="mt-4" variant="outline">
                Volver
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableRecipients = miembros.filter((m) => m.id !== currentMiembro.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nuevo Mensaje</h2>
          <p className="text-muted-foreground">Enviando como: {currentMiembro.nombre}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Redactar Mensaje</CardTitle>
          <CardDescription>Selecciona el destinatario y escribe tu mensaje</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="recipient" className="text-sm font-medium">
                Destinatario
              </label>
              <select
                id="recipient"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="">Selecciona un miembro...</option>
                {availableRecipients.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {m.email ? `(${m.email})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="content" className="text-sm font-medium">
                Mensaje
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
                rows={5}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                required
                disabled={sending}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={sending || !recipientId || !content.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Mensaje
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleBack} disabled={sending}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
