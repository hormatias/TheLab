// Edge Function: recibe audio en base64, llama a OpenAI Whisper y devuelve el texto transcrito

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const audioBase64 = body?.audio;
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Se requiere el campo 'audio' en base64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY no está configurada en Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = body.contentType || "audio/webm";
    const bytes = base64ToUint8Array(audioBase64);
    const blob = new Blob([bytes], { type: contentType });
    const formData = new FormData();
    const fileExtension = contentType.includes("mp4") ? "audio.m4a" : "audio.webm";
    formData.append("file", blob, fileExtension);
    formData.append("model", "whisper-1");

    const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: errText || `OpenAI error: ${openaiRes.status}` }),
        { status: openaiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await openaiRes.json();
    const text = result?.text ?? "";

    let title = "";
    if (text.trim()) {
      try {
        const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "user",
                content: `Dado el siguiente texto de una nota, genera un título corto (máximo 5-8 palabras) en el mismo idioma. Responde únicamente con el título, sin comillas ni explicaciones.\n\n${text}`,
              },
            ],
            max_tokens: 50,
          }),
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const raw = chatData?.choices?.[0]?.message?.content?.trim() ?? "";
          title = raw.replace(/^["']|["']$/g, "").trim();
        }
      } catch (e) {
        console.error("Chat title error:", e);
      }
    }

    return new Response(JSON.stringify({ text, title: title ?? "" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("transcribe-audio error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error al transcribir" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
