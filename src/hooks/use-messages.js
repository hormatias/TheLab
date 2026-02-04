import { supabase } from "@/lib/supabase";

// Tabla configurable por env; no depender del nombre concreto de la base/tabla
const TABLE_NAME = import.meta.env.VITE_SUPABASE_ENTITIES_TABLE ?? "entities";
const MESSAGE_TYPE = "mensaje";

/**
 * Parsea una fila del backend a un objeto de mensaje
 */
function parseMessage(row) {
  if (!row) return null;
  try {
    const data = row.data || {};
    return {
      id: row.id,
      sender_id: data.sender_id,
      recipient_id: data.recipient_id,
      content: data.content,
      read: data.read ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (e) {
    console.error("Error parsing message:", e);
    return null;
  }
}

/**
 * Hook para gestionar mensajes privados entre miembros.
 * Usa la tabla de entidades (nombre configurable por env) con type: "mensaje".
 *
 * Estructura de data:
 * { sender_id, recipient_id, content, read }
 */
export function useMessages() {
  async function getInbox(miembroId) {
    const { data: rows, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("type", MESSAGE_TYPE)
      .eq("data->>recipient_id", miembroId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error getting inbox:", error);
      throw error;
    }
    return (rows || []).map(parseMessage).filter(Boolean);
  }

  async function getSent(miembroId) {
    const { data: rows, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("type", MESSAGE_TYPE)
      .eq("data->>sender_id", miembroId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error getting sent messages:", error);
      throw error;
    }
    return (rows || []).map(parseMessage).filter(Boolean);
  }

  async function getConversation(miembroId, otroMiembroId) {
    const [res1, res2] = await Promise.all([
      supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("type", MESSAGE_TYPE)
        .eq("data->>sender_id", miembroId)
        .eq("data->>recipient_id", otroMiembroId)
        .order("created_at", { ascending: true })
        .limit(250),
      supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("type", MESSAGE_TYPE)
        .eq("data->>sender_id", otroMiembroId)
        .eq("data->>recipient_id", miembroId)
        .order("created_at", { ascending: true })
        .limit(250),
    ]);

    if (res1.error) throw res1.error;
    if (res2.error) throw res2.error;

    const messages = [
      ...(res1.data || []).map(parseMessage),
      ...(res2.data || []).map(parseMessage),
    ].filter(Boolean);
    messages.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return messages;
  }

  async function send(senderId, recipientId, content) {
    const { data: row, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        type: MESSAGE_TYPE,
        data: {
          sender_id: senderId,
          recipient_id: recipientId,
          content: content.trim(),
          read: false,
        },
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending message:", error);
      throw error;
    }
    return parseMessage(row);
  }

  async function markAsRead(messageId) {
    const { data: current, error: fetchError } = await supabase
      .from(TABLE_NAME)
      .select("data")
      .eq("id", messageId)
      .eq("type", MESSAGE_TYPE)
      .single();

    if (fetchError) {
      console.error("Error marking message as read:", fetchError);
      throw fetchError;
    }

    const newData = { ...(current?.data || {}), read: true };
    const { data: row, error } = await supabase
      .from(TABLE_NAME)
      .update({ data: newData })
      .eq("id", messageId)
      .eq("type", MESSAGE_TYPE)
      .select()
      .single();

    if (error) throw error;
    return parseMessage(row);
  }

  async function markConversationAsRead(miembroId, otroMiembroId) {
    const { data: rows, error } = await supabase
      .from(TABLE_NAME)
      .select("id, data")
      .eq("type", MESSAGE_TYPE)
      .eq("data->>sender_id", otroMiembroId)
      .eq("data->>recipient_id", miembroId)
      .limit(500);

    if (error) {
      console.error("Error marking conversation as read:", error);
      throw error;
    }

    const unread = (rows || []).filter((r) => {
      const read = r.data?.read;
      return read !== true;
    });

    await Promise.all(
      unread.map((r) =>
        supabase
          .from(TABLE_NAME)
          .update({ data: { ...r.data, read: true } })
          .eq("id", r.id)
          .eq("type", MESSAGE_TYPE)
      )
    );
  }

  async function getUnreadCount(miembroId) {
    const { data: rows, error } = await supabase
      .from(TABLE_NAME)
      .select("id, data")
      .eq("type", MESSAGE_TYPE)
      .eq("data->>recipient_id", miembroId)
      .limit(500);

    if (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }

    return (rows || []).filter((r) => r.data?.read !== true).length;
  }

  async function getConversations(miembroId) {
    const [inbox, sent] = await Promise.all([
      getInbox(miembroId),
      getSent(miembroId),
    ]);
    const myMessages = [...inbox, ...sent].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const conversationsMap = new Map();

    myMessages.forEach((msg) => {
      const otherMiembroId =
        msg.sender_id === miembroId ? msg.recipient_id : msg.sender_id;

      if (!conversationsMap.has(otherMiembroId)) {
        conversationsMap.set(otherMiembroId, {
          otherMiembroId,
          lastMessage: msg,
          unreadCount: 0,
        });
      }

      if (msg.recipient_id === miembroId && !msg.read) {
        const conv = conversationsMap.get(otherMiembroId);
        conv.unreadCount++;
      }
    });

    return Array.from(conversationsMap.values());
  }

  return {
    getInbox,
    getSent,
    getConversation,
    getConversations,
    send,
    markAsRead,
    markConversationAsRead,
    getUnreadCount,
  };
}
