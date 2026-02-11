const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
/** Máximo de tokens de salida para deepseek-chat (límite API). Para respuestas muy largas puede usarse deepseek-reasoner con max_tokens mayor. */
const DEFAULT_MAX_TOKENS = 8000;

/**
 * @param {string} systemPrompt
 * @param {string} [userMessage]
 * @param {{ model?: string, max_tokens?: number }} [options] - model: 'deepseek-chat' | 'deepseek-reasoner'; max_tokens (reasoner permite hasta 64k)
 */
export async function queryDeepSeek(systemPrompt, userMessage = "Analiza este proyecto y proporciona insights útiles.", options = {}) {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("VITE_DEEPSEEK_API_KEY no está configurada. Por favor, agrega tu API key en el archivo .env.local");
  }

  const model = options.model || DEEPSEEK_MODEL;
  const max_tokens = options.max_tokens ?? DEFAULT_MAX_TOKENS;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Error de API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No se recibió respuesta de la API";
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Error desconocido al consultar DeepSeek API");
  }
}
