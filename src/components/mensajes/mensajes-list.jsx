import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMessages } from "@/hooks/use-messages";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, AlertCircle, Plus, RefreshCw, Mail, MailOpen } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function MensajesList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [conversations, setConversations] = useState([]);
  const [miembros, setMiembros] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMiembro, setCurrentMiembro] = useState(null);

  const messagesApi = useMessages();
  const miembrosApi = useEntities("miembro");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const { data: miembrosData } = await miembrosApi.list({});
      const miembrosMap = {};
      miembrosData.forEach((m) => {
        miembrosMap[m.id] = m;
      });
      setMiembros(miembrosMap);

      if (miembrosData.length > 0) {
        setCurrentMiembro(miembrosData[0]);
        const convs = await messagesApi.getConversations(miembrosData[0].id);
        setConversations(convs);
      }
    } catch (err) {
      console.error("Error al cargar datos:", err);
      setError(err.message || "Error al cargar mensajes");
    } finally {
      setLoading(false);
    }
  }

  async function handleMiembroChange(miembroId) {
    try {
      setLoading(true);
      setCurrentMiembro(miembros[miembroId]);
      const convs = await messagesApi.getConversations(miembroId);
      setConversations(convs);
    } catch (err) {
      console.error("Error al cambiar miembro:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando mensajes...</span>
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
              <p className="font-medium">Error al cargar mensajes</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadData} className="mt-4" variant="outline">
                Reintentar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const miembrosList = Object.values(miembros);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mensajes</h2>
          <p className="text-muted-foreground">
            {conversations.length} {conversations.length === 1 ? "conversación" : "conversaciones"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadData}
            variant="outline"
            size={isMobile ? "icon" : "sm"}
            title="Actualizar"
          >
            <RefreshCw className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Actualizar"}
          </Button>
          <Button
            onClick={() => navigate("/mensajes/nuevo")}
            size={isMobile ? "icon" : "sm"}
            title="Nuevo Mensaje"
          >
            <Plus className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Nuevo Mensaje"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Viendo mensajes como:</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={currentMiembro?.id || ""}
            onChange={(e) => handleMiembroChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {miembrosList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} {m.email ? `(${m.email})` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-2">
            En producción, esto sería el usuario autenticado
          </p>
        </CardContent>
      </Card>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay conversaciones</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Envía tu primer mensaje para comenzar
                </p>
                <Button onClick={() => navigate("/mensajes/nuevo")} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Mensaje
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const otherMiembro = miembros[conv.otherMiembroId];
            const hasUnread = conv.unreadCount > 0;
            return (
              <Card
                key={conv.otherMiembroId}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer",
                  hasUnread && "border-primary/50 bg-primary/5"
                )}
                onClick={() => navigate(`/mensajes/${conv.otherMiembroId}?from=${currentMiembro?.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {hasUnread ? (
                        <Mail className="h-5 w-5 text-primary" />
                      ) : (
                        <MailOpen className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("font-medium truncate", hasUnread && "text-primary")}>
                          {otherMiembro?.nombre || "Usuario desconocido"}
                        </p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDate(conv.lastMessage.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {conv.lastMessage.sender_id === currentMiembro?.id && "Tú: "}
                        {conv.lastMessage.content}
                      </p>
                      {hasUnread && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 mt-2 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                          {conv.unreadCount} {conv.unreadCount === 1 ? "nuevo" : "nuevos"}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
