// Supabase Edge Function para generar datos fake coherentes usando OpenAI GPT-4o
// Recibe campos del formulario con sus descripciones y genera valores de prueba

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createOpenAI } from "npm:@ai-sdk/openai@1.0.0";
import { generateObject } from "npm:ai@4.0.0";
import { z } from "npm:zod@3.23.0";

// Schema para un campo individual
const FieldValueSchema = z.object({
  fieldName: z.string().describe("Nombre exacto del campo"),
  value: z.union([z.string(), z.boolean()]).describe("Valor generado para el campo"),
});

// Schema para la respuesta de OpenAI - estructura más explícita
const FakeDataResponseSchema = z.object({
  fieldValues: z.array(FieldValueSchema).describe("Array con un valor para CADA campo del formulario"),
  personaInfo: z.object({
    fullName: z.string().describe("Nombre completo de la persona ficticia"),
    nif: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    iban: z.string().optional(),
  }).optional().describe("Información de referencia de la persona ficticia"),
});

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Prompt del sistema para generar datos fake
const systemPrompt = `Eres un experto en generar datos de prueba realistas y coherentes para formularios.

INSTRUCCIONES:
1. Genera datos COHERENTES - todos los campos deben pertenecer a la MISMA persona/entidad ficticia
2. Los datos deben ser REALISTAS pero claramente ficticios (no usar datos reales)
3. Para Andorra, usa formatos locales:
   - IBAN: AD + 2 dígitos control + 4 dígitos banco + 4 dígitos sucursal + 12 dígitos cuenta (total 24 campos)
   - Teléfono: +376 XXX XXX
   - Código postal: AD500, AD600, etc.
4. Para checkboxes, usa true/false según tenga sentido en el contexto
5. Para fechas, usa formato dd/mm/yyyy
6. Si hay campos para firma, pon "FIRMA DIGITALIZADA" o similar

IMPORTANTE:
- El valor de cada campo debe coincidir EXACTAMENTE con la descripción del campo
- Si un campo es "Nombre completo", genera el nombre completo, no solo el nombre
- Si hay múltiples campos IBAN (dígitos separados), distribuye el IBAN correctamente
- Mantén consistencia: si el nombre aparece en varios sitios, usa el mismo nombre

DATOS DE EJEMPLO PARA ANDORRA:
- Nombres: Marc, Laia, Joan, Maria, Àlex, Anna
- Apellidos: Martí, Garcia, López, Fernández, Pujol, Serra
- Calles: Av. Meritxell, Carrer Major, Plaça del Poble
- Poblaciones: Andorra la Vella, Escaldes-Engordany, Sant Julià de Lòria
- Bancos andorranos (códigos): 0001 (Andbank), 0002 (Crèdit Andorrà), 0003 (MoraBanc)`;

// Tipo para campos con posición
interface FieldInput {
  name: string;
  type: string;
  description: string;
  page: number;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  index: number;
}

// Detectar secuencias de campos IBAN por coordenadas
// IBAN andorrano: 22 caracteres (sin AD que ya está en el formulario) o 24 con AD
function detectIbanSequences(fields: FieldInput[]): { start: number; length: number; page: number }[] {
  const sequences: { start: number; length: number; page: number }[] = [];
  
  // Agrupar por página
  const byPage: Record<number, FieldInput[]> = {};
  fields.forEach(f => {
    const page = f.page || 1;
    if (!byPage[page]) byPage[page] = [];
    byPage[page].push(f);
  });
  
  // Para cada página, buscar secuencias de campos pequeños alineados horizontalmente
  for (const [page, pageFields] of Object.entries(byPage)) {
    // Ordenar por posición Y (filas) y luego por X
    const sorted = [...pageFields].sort((a, b) => {
      const yDiff = (a.position?.y || 0) - (b.position?.y || 0);
      if (Math.abs(yDiff) < 10) { // Misma fila (tolerancia de 10px)
        return (a.position?.x || 0) - (b.position?.x || 0);
      }
      return yDiff;
    });
    
    let currentSequence: FieldInput[] = [];
    let lastX = -1000;
    let lastY = -1000;
    
    for (const field of sorted) {
      const x = field.position?.x || 0;
      const y = field.position?.y || 0;
      const width = field.position?.width || 0;
      
      // Un campo es candidato a IBAN si:
      // 1. Es pequeño (ancho < 40px, típico para 1-2 caracteres)
      // 2. Está en la misma fila que el anterior (Y similar)
      // 3. Está cerca horizontalmente del anterior
      const isSmall = width > 0 && width < 40;
      const sameRow = Math.abs(y - lastY) < 10;
      const closeHorizontally = x - lastX < 50;
      
      if (isSmall && sameRow && closeHorizontally && currentSequence.length > 0) {
        currentSequence.push(field);
      } else if (isSmall) {
        // Empezar nueva secuencia potencial
        if (currentSequence.length >= 10) {
          // La secuencia anterior era válida (IBAN tiene mínimo 22 campos)
          sequences.push({
            start: currentSequence[0].index,
            length: currentSequence.length,
            page: parseInt(page),
          });
        }
        currentSequence = [field];
      } else {
        // Campo grande, cerrar secuencia si existe
        if (currentSequence.length >= 10) {
          sequences.push({
            start: currentSequence[0].index,
            length: currentSequence.length,
            page: parseInt(page),
          });
        }
        currentSequence = [];
      }
      
      lastX = x + width;
      lastY = y;
    }
    
    // Cerrar última secuencia
    if (currentSequence.length >= 10) {
      sequences.push({
        start: currentSequence[0].index,
        length: currentSequence.length,
        page: parseInt(page),
      });
    }
  }
  
  return sequences;
}

// Generar IBAN andorrano válido
function generateAndorranIban(): string {
  const bankCodes = ["0001", "0002", "0003", "0004"];
  const bank = bankCodes[Math.floor(Math.random() * bankCodes.length)];
  const branch = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const account = String(Math.floor(Math.random() * 1000000000000)).padStart(12, "0");
  // AD + 2 dígitos control + banco + sucursal + cuenta
  const controlDigits = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `AD${controlDigits}${bank}${branch}${account}`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fields } = await req.json();

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return new Response(
        JSON.stringify({ error: "Se requiere un array de campos con descripciones" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obtener API key de OpenAI desde secrets
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY no está configurada en Supabase Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Crear cliente OpenAI con Vercel AI SDK
    const openai = createOpenAI({
      apiKey: openaiApiKey,
    });

    console.log(`🎲 Generando datos fake para ${fields.length} campos...`);

    // Detectar secuencias IBAN por coordenadas
    const ibanSequences = detectIbanSequences(fields as FieldInput[]);
    console.log(`📋 Secuencias IBAN detectadas: ${ibanSequences.length}`);
    for (const seq of ibanSequences) {
      console.log(`   - Página ${seq.page}: campos ${seq.start} a ${seq.start + seq.length - 1} (${seq.length} caracteres)`);
    }

    // Marcar campos IBAN en la descripción para OpenAI
    const fieldsWithIbanInfo = (fields as FieldInput[]).map((f, i) => {
      const inIbanSeq = ibanSequences.find(seq => i >= seq.start && i < seq.start + seq.length);
      if (inIbanSeq) {
        const posInIban = i - inIbanSeq.start;
        return {
          ...f,
          description: `IBAN carácter ${posInIban + 1} de ${inIbanSeq.length}`,
          isIbanChar: true,
          ibanPosition: posInIban,
          ibanLength: inIbanSeq.length,
        };
      }
      return f;
    });

    // Construir el prompt con los campos (excluyendo campos IBAN individuales)
    const nonIbanFields = fieldsWithIbanInfo.filter(f => !(f as any).isIbanChar);
    const fieldsDescription = nonIbanFields.map((f, i) => 
      `${i + 1}. Campo "${f.name}" (${f.type}, página ${f.page}): ${f.description || "Sin descripción"}`
    ).join("\n");

    // Información sobre IBAN detectados
    const ibanInfo = ibanSequences.length > 0 
      ? `\n\nNOTA: Se detectaron ${ibanSequences.length} secuencia(s) de campos IBAN que se rellenarán automáticamente.`
      : "";

    const userPrompt = `Genera datos de prueba para estos ${nonIbanFields.length} campos de formulario:

${fieldsDescription}${ibanInfo}

Debes generar un valor para CADA campo listado arriba.
Para checkboxes usa true/false, para texto usa strings.
Usa los nombres de campo EXACTAMENTE como aparecen entre comillas.`;

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: FakeDataResponseSchema,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Convertir array a objeto para el frontend
    const values: Record<string, string | boolean> = {};
    for (const item of result.object.fieldValues) {
      values[item.fieldName] = item.value;
    }

    // Generar IBAN y distribuirlo en los campos detectados
    const generatedIban = generateAndorranIban();
    console.log(`💳 IBAN generado: ${generatedIban}`);
    
    for (const seq of ibanSequences) {
      // Determinar si el IBAN empieza con AD o no (si hay 22 campos, AD ya está en el form)
      const ibanChars = seq.length === 22 
        ? generatedIban.slice(2) // Sin AD
        : generatedIban; // Completo
      
      for (let i = 0; i < seq.length; i++) {
        const fieldIndex = seq.start + i;
        const field = (fields as FieldInput[])[fieldIndex];
        if (field) {
          values[field.name] = ibanChars[i] || "";
        }
      }
      console.log(`   Distribuido en campos ${seq.start} a ${seq.start + seq.length - 1}`);
    }

    // Construir objeto persona desde personaInfo
    const persona = result.object.personaInfo ? {
      nombre: result.object.personaInfo.fullName?.split(" ")[0] || "",
      apellidos: result.object.personaInfo.fullName?.split(" ").slice(1).join(" ") || "",
      nif: result.object.personaInfo.nif,
      email: result.object.personaInfo.email,
      telefono: result.object.personaInfo.phone,
      direccion: result.object.personaInfo.address,
      iban: generatedIban, // Usar el IBAN que generamos
    } : {
      nombre: "",
      apellidos: "",
      iban: generatedIban,
    };

    console.log(`✓ Datos generados para ${Object.keys(values).length} campos`);
    if (persona.nombre) {
      console.log(`  Persona: ${persona.nombre} ${persona.apellidos}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        values,
        persona,
        ibanSequences: ibanSequences.map(s => ({
          ...s,
          iban: generatedIban,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en generate-fake-data:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido",
        details: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
