import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { useMessages } from "@/hooks/use-messages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, FolderOpen, Eye, Mail, MessageSquare, MailOpen } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function MiembroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [miembro, setMiembro] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [allMiembros, setAllMiembros] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const miembrosApi = useEntities("miembro");
  const proyectosApi = useEntities("proyecto");
  const messagesApi = useMessages();

  useEffect(() => {
    loadMiembro();
    loadProyectos();
    loadConversations();
  }, [id]);

  async function loadMiembro() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await miembrosApi.get(id);

      if (!data) {
        throw new Error("Miembro no encontrado");
      }

      setMiembro(data);
    } catch (err) {
      console.error("Error al cargar miembro:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProyectos() {
    try {
      const { data: allProyectos } = await proyectosApi.list({ orderBy: "nombre", ascending: true });
      const proyectosData = (allProyectos || [])
        .filter((p) => {
          const miembroIds = p?.miembro_ids || [];
          return Array.isArray(miembroIds) && miembroIds.includes(id);
        })
        .map((p) => ({ id: p.id, nombre: p.nombre || "Sin nombre" }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setProyectos(proyectosData);
    } catch (err) {
      console.error("Error al cargar proyectos del miembro:", err);
    }
  }

  async function loadConversations() {
    try {
      const { data: miembrosData } = await miembrosApi.list({});
      const miembrosMap = {};
      miembrosData.forEach((m) => {
        miembrosMap[m.id] = m;
      });
      setAllMiembros(miembrosMap);
      const convs = await messagesApi.getConversations(id);
      setConversations(convs);
    } catch (err) {
      console.error("Error al cargar conversaciones:", err);
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
          <span className="ml-2 text-muted-foreground">Cargando miembro...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !miembro) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar miembro</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error || "Miembro no encontrado"}
              </p>
              <Button onClick={() => navigate("/miembros")} className="mt-4" variant="outline">
                Volver a Miembros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/miembros")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{miembro.nombre}</h2>
          <p className="text-muted-foreground">Detalles del miembro</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del Miembro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre</p>
              <p className="text-lg">{miembro.nombre}</p>
            </div>
            {miembro.email && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </p>
                <p className="text-lg">{miembro.email}</p>
              </div>
            )}
            {miembro.id && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p className="text-sm font-mono">{miembro.id}</p>
              </div>
            )}
            <div className="pt-4 border-t">
              <Button
                onClick={() => navigate(`/mensajes/nuevo?from=${miembro.id}`)}
                className="w-full"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar Mensaje
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Proyectos ({proyectos.length})
            </CardTitle>
            <CardDescription>
              Proyectos asignados a este miembro
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proyectos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este miembro no tiene proyectos asignados
              </p>
            ) : (
              <div className="space-y-2">
                {proyectos.map((proyecto) => (
                  <Button
                    key={proyecto.id}
                    variant="outline"
                    className={cn("w-full", isMobile ? "justify-center" : "justify-start")}
                    size={isMobile ? "icon" : "default"}
                    onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                    title={isMobile ? proyecto.nombre : undefined}
                  >
                    {isMobile ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      proyecto.nombre
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversaciones ({conversations.length})
            {conversations.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                {conversations.reduce((acc, c) => acc + c.unreadCount, 0)}{" "}
                {conversations.reduce((acc, c) => acc + c.unreadCount, 0) === 1 ? "nuevo" : "nuevos"}
              </span>
            )}
          </CardTitle>
          <CardDescription>Mensajes de este miembro con otros miembros</CardDescription>
        </CardHeader>
        <CardContent>
          {conversations.length === 0 ? (
            <div className="text-center py-6">
              <MailOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Este miembro no tiene conversaciones</p>
              <Button
                onClick={() => navigate(`/mensajes/nuevo?from=${miembro.id}`)}
                variant="outline"
                className="mt-4"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Iniciar conversación
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => {
                const otherMiembro = allMiembros[conv.otherMiembroId];
                const hasUnread = conv.unreadCount > 0;
                return (
                  <div
                    key={conv.otherMiembroId}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                      hasUnread && "border-primary/50 bg-primary/5"
                    )}
                    onClick={() => navigate(`/mensajes/${conv.otherMiembroId}?from=${id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("font-medium truncate", hasUnread && "text-primary")}>
                          {otherMiembro?.nombre || "Usuario desconocido"}
                        </p>
                        {hasUnread && (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastMessage.sender_id === id && "Tú: "}
                        {conv.lastMessage.content}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {formatDate(conv.lastMessage.created_at)}
                    </span>
                  </div>
                );
              })}
              <Button
                onClick={() => navigate(`/mensajes/nuevo?from=${id}`)}
                variant="outline"
                className="w-full mt-4"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Nuevo mensaje
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
