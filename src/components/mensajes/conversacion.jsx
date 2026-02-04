import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMessages } from "@/hooks/use-messages";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function Conversacion() {
  const { miembroId: otherMiembroId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [currentMiembro, setCurrentMiembro] = useState(null);
  const [otherMiembro, setOtherMiembro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState("");

  const messagesApi = useMessages();
  const miembrosApi = useEntities("miembro");

  const fromParam = searchParams.get("from");

  useEffect(() => {
    loadData();
  }, [otherMiembroId, fromParam]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const { data: miembrosData } = await miembrosApi.list({});
      const other = miembrosData.find((m) => m.id === otherMiembroId);
      setOtherMiembro(other);

      const current = miembrosData.find((m) => m.id === fromParam);
      if (!current) {
        throw new Error("No se especificó el miembro remitente");
      }
      setCurrentMiembro(current);

      if (current && other) {
        const conversation = await messagesApi.getConversation(current.id, otherMiembroId);
        setMessages(conversation);
        await messagesApi.markConversationAsRead(current.id, otherMiembroId);
      }
    } catch (err) {
      console.error("Error al cargar conversación:", err);
      setError(err.message || "Error al cargar la conversación");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim() || !currentMiembro || !otherMiembro) return;
    try {
      setSending(true);
      const message = await messagesApi.send(
        currentMiembro.id,
        otherMiembro.id,
        newMessage.trim()
      );
      setMessages([...messages, message]);
      setNewMessage("");
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
      alert(`Error al enviar: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Hoy";
    if (date.toDateString() === yesterday.toDateString()) return "Ayer";
    return date.toLocaleDateString();
  }

  function groupMessagesByDate(msgs) {
    const groups = [];
    let currentDate = null;
    msgs.forEach((message) => {
      const messageDate = formatDate(message.created_at);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ type: "date", date: messageDate });
      }
      groups.push({ type: "message", message });
    });
    return groups;
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
          <span className="ml-2 text-muted-foreground">Cargando conversación...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !otherMiembro || !currentMiembro) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error || "Miembro no encontrado"}
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

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">Conversación con {otherMiembro.nombre}</h2>
          <p className="text-sm text-muted-foreground">
            Enviando como: {currentMiembro.nombre}
          </p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No hay mensajes aún. ¡Envía el primero!
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMessages.map((item, index) => {
                if (item.type === "date") {
                  return (
                    <div key={`date-${index}`} className="flex justify-center">
                      <span className="px-3 py-1 text-xs bg-muted rounded-full text-muted-foreground">
                        {item.date}
                      </span>
                    </div>
                  );
                }
                const message = item.message;
                const isMine = message.sender_id === currentMiembro?.id;
                return (
                  <div
                    key={message.id}
                    className={cn("flex", isMine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={cn(
                          "text-xs mt-1",
                          isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {formatTime(message.created_at)}
                        {isMine && <span className="ml-2">{message.read ? "✓✓" : "✓"}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSend} className="mt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
