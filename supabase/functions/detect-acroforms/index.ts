// Supabase Edge Function per detectar camps AcroForm en PDFs usant OpenAI GPT-4o Vision
// Usa Vercel AI SDK per la integració amb OpenAI
// Analitza cada pàgina per separat per major precisió

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createOpenAI } from "npm:@ai-sdk/openai@1.0.0";
import { generateObject } from "npm:ai@4.0.0";
import { z } from "npm:zod@3.23.0";

// Schema simplificat: només el significat/descripció de cada camp
const PageFieldSchema = z.object({
  label: z.string().describe("Descripció clara de quina informació ha d'anar en aquest camp (ex: 'Nom complet del sol·licitant', 'Accepta els termes i condicions')"),
  order: z.number().describe("Ordre del camp a la pàgina (1, 2, 3...)"),
});

const PageDetectionSchema = z.object({
  fields: z.array(PageFieldSchema).describe("Llista de camps detectats amb el seu significat"),
  pageSummary: z.string().describe("Resum breu de què tracta aquesta pàgina del formulari (1-2 frases)"),
});

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Prompt del sistema per descriure el significat dels camps
const systemPrompt = `Ets un expert en anàlisi de formularis. La teva tasca és descriure el SIGNIFICAT de cada camp de formulari visible a la imatge.

INSTRUCCIONS:
1. Analitza la pàgina i troba tots els camps omplibles (caixes de text, checkboxes, línies per escriure)
2. Per a cada camp, descriu EN CATALÀ quina informació ha d'anar-hi
3. Ordena els camps de dalt a baix, d'esquerra a dreta
4. Proporciona un resum breu de què tracta aquesta pàgina

EXEMPLES DE LABELS:
- "Cognoms i nom del sol·licitant"
- "Número d'identificació fiscal (NIF/NIE)"
- "Accepta les condicions del servei"
- "Adreça de correu electrònic"
- "Codi IBAN - dígits 1-4"
- "Data de naixement (dd/mm/aaaa)"
- "Signatura de l'interessat"
- "Núm. CASS"

IMPORTANT:
- Utilitza llenguatge clar i descriptiu
- Si hi ha diversos camps per a IBAN o números (com Núm. CASS), numera'ls (dígits 1-4, 5-8, etc.)
- Per a checkboxes, descriu què s'està acceptant/seleccionant
- El resum ha d'explicar el propòsit d'aquesta secció del formulari`;

async function analyzePageWithOpenAI(
  openai: ReturnType<typeof createOpenAI>,
  imageBase64: string,
  pageNumber: number
): Promise<{ fields: z.infer<typeof PageFieldSchema>[]; pageSummary: string }> {
  
  const imageContent = imageBase64.startsWith("data:") 
    ? imageBase64 
    : `data:image/png;base64,${imageBase64}`;

  const userPrompt = `Analitza aquesta PÀGINA ${pageNumber} d'un formulari PDF. Descriu el significat de cada camp omplible que vegis, ordenats de dalt a baix. Inclou un resum de què tracta aquesta pàgina.`;

  const result = await generateObject({
    model: openai("gpt-4o"),
    schema: PageDetectionSchema,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image", image: imageContent },
        ],
      },
    ],
  });

  return {
    fields: result.object.fields,
    pageSummary: result.object.pageSummary,
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "Es requereix un array d'imatges en base64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limitar a 6 pàgines màxim per controlar costos
    const limitedImages = images.slice(0, 6);

    // Obtenir API key d'OpenAI des de secrets
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY no està configurada a Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Crear client OpenAI amb Vercel AI SDK
    const openai = createOpenAI({
      apiKey: openaiApiKey,
    });

    console.log(`📄 Analitzant ${limitedImages.length} pàgines per separat...`);

    // Analitzar cada pàgina per separat (en paral·lel per major velocitat)
    const pagePromises = limitedImages.map((imageBase64: string, index: number) => 
      analyzePageWithOpenAI(openai, imageBase64, index + 1)
        .then(result => ({
          page: index + 1,
          ...result,
        }))
        .catch(error => {
          console.error(`Error a la pàgina ${index + 1}:`, error);
          return {
            page: index + 1,
            fields: [],
            pageSummary: `Error en analitzar: ${error.message}`,
            error: error.message,
          };
        })
    );

    const pageResults = await Promise.all(pagePromises);

    // Estructura simplificada: només labels organitzats per pàgina
    const pages = pageResults.map(pageResult => ({
      page: pageResult.page,
      summary: pageResult.pageSummary,
      fields: pageResult.fields.map(f => f.label), // Només els labels
    }));

    const totalFields = pages.reduce((sum, p) => sum + p.fields.length, 0);
    
    console.log(`✓ OpenAI ha descrit ${totalFields} camps en ${limitedImages.length} pàgines`);
    
    // Log resum per pàgina
    for (const page of pages) {
      console.log(`  Pàgina ${page.page}: ${page.fields.length} camps - ${page.summary.substring(0, 50)}...`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pages: pages,
        totalPages: limitedImages.length,
        totalFields: totalFields,
        provider: "openai",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error a detect-acroforms:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconegut",
        details: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
