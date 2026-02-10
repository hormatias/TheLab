# The Lab

## ¿Qué es?
Un proyecto de gestión de laboratorios de código. Personalizado e impulsado con integraciones de frontera.

## Base de datos
Guardamos todo en Supabase. Utilizamos funciones Edge para crear puntos donde enviar la información. Como recibir una descripción y analizarla con IA.

## ¿Qué son las entities?
Las entidades son una unidad básica del Laboratorio (proyectos, clientes, miembros, formularios, cámaras, notas) vive en tabla llamada `entities` en la base de datos.

Puedes crear tu propia entity tan solo agregando un nuevo type y jsonb.

La idea es aprovechar la flexibilidad de jsonb y markdown para guardar los datos y que sean entendidos por otras plataformas para asegurar la integrabilidad.

Cada fila tiene:
- **id** (UUID)
- **type** – tipo de entidad (string)
- **data** – JSONB con los campos propios de ese entity
- **created_at**, **updated_at**

## Tipos de entidad y campos de `data` (JSON)

Cada entity tiene su `data` como JSONB. Estructura por entity.

- Una entity `"proyecto"` tendrá en su `data`:  
  `{ "nombre": "...", "descripcion": "...", ... }`
- Un `"cliente"`:  
  `{ "nombre": "...", "tipo_cliente": "...", "equipo": [...], ... }`
- Un `"miembro"`:  
  `{ "nombre": "...", "email": "..." }`

**Nota:** Los campos comunes (`id`, `type`, `created_at`, `updated_at`) 

Estas son las entidades:

### proyecto

```json
{
  "nombre": "string",
  "descripcion": "string | null", // Markdown
  "cliente_id": "uuid | null",
  "tareas": [
    {
      "id": "uuid",
      "nombre": "string",
      "completada": false,
      "fecha_inicio": "YYYY-MM-DD | null",
      "fecha_fin": "YYYY-MM-DD | null",
      "created_at": "ISO date string"
    }
  ],
  "presupuesto": "number | null",
  "moneda": "string (ej. EUR)",
  "tipo_presupuesto": "unico | recurrente | fraccionado",
  "frecuencia_recurrencia": "mensual | trimestral | anual | personalizado | null",
  "numero_cuotas": "number | null",
  "fecha_inicio_primer_pago": "YYYY-MM-DD | null",
  "fechas_cobro_personalizadas": [
    {
      "fecha": "YYYY-MM-DD",
      "monto": "number",
      "porcentaje": "number",
      "moneda": "string"
    }
  ],
  "miembro_ids": ["uuid"]
}
```

### cliente

```json
{
  "nombre": "string",
  "tipo_cliente": "empresa | particular | null",
  "descripcion": "string | null", // Markdown
  "equipo": [
    {
      "nombre": "string",
      "rol": "string",
      "descripcion": "string"
    }
  ]
}
```

Si `tipo_cliente` es `"particular"`, el cliente no tiene equipo y sí tiene `descripcion`.

### miembro

```json
{
  "nombre": "string",
  "email": "string"
}
```

### formulario

```json
{
  "nombre": "string",
  "descripcion": "string | null", // Markdown
  "pdf_path": "string | null"
}
```

### camara

```json
{
  "nombre": "string",
  "url": "string",
  "pueblo": "string | null",
  "parroquia": "string | null"
}
```

### nota

```json
{
  "titulo": "string",
  "descripcion": "string | null"
}
```

La descripción admite Markdown. Al leer, se usa `descripcion ?? contenido` por compatibilidad con notas antiguas.

## Funciones

Todas usan **OPENAI_API_KEY** en Supabase Secrets. El front las llama con **fetch** y cabeceras `Authorization: Bearer <key>` y `apikey: <key>`.

| Función | Qué hace | Dónde se usa |
|--------|----------|--------------|
| **transcribe-audio** | Audio (base64) → texto con Whisper | Notas: "Grabar y transcribir" |
| **generate-fake-data** | Genera datos fake coherentes para campos del formulario (GPT-4o) | Formularios: rellenar con datos de prueba |
| **detect-acroforms** | Imágenes de páginas PDF (base64) → campos y descripción por página (Vision, máx. 6 págs.) | Formularios: detección de campos al analizar PDF |

Código: `supabase/functions/<nombre>/index.ts`.

## Editor de Markdown

En las pantallas donde se editan campos en Markdown se usa el patrón **vista → Editar → edición**:

- **Por defecto:** modo vista (solo lectura). El contenido se muestra renderizado con `react-markdown`; no se duplica editor y vista previa.
- **Botón "Editar":** pasa al modo edición (textarea con el Markdown en crudo). Guardar persiste y vuelve a vista; Cancelar descarta y vuelve a vista.

Referencia: `nota-detail.jsx` (estado `isEditing`, botón Editar).

## Cómo se usan en código

- **Hook:** `useEntities(tipo)` → devuelve `list`, `get`, `create`, `update`, `remove`, `search`, `subscribe`.
- Las respuestas vienen **aplanadas**: los campos de `data` se exponen al mismo nivel que `id`, `type`, `created_at`, `updated_at` (y `_raw` con el objeto crudo).
- Para relaciones: `getEntityById(type, id)` y `getEntitiesByIds(type, ids)` en `use-entities.js`.

No hay tablas separadas por tipo; todo es `entities` filtrado por `type`.

## Gestión del repositorio y commits

### Gestión del repo

- Trabajo en la rama `main`.
- **No commitear:** secretos, `.env`, `.env.local` (ya ignorados con `*.local` en `.gitignore`). No subir `OPENAI_API_KEY` ni claves privadas de Supabase; las Edge Functions usan Supabase Secrets.
- **Antes de commitear:** revisar con `git status` y `git diff` (o `git diff --stat`) qué se incluye; separar cambios por funcionalidad en distintos commits.

### Forma de commitear

- **Mensajes:** formato `tipo(ámbito): descripción breve`. Tipos: `feat` (nueva funcionalidad), `fix` (corrección), `docs` (solo documentación), `refactor`, `chore`.
- **Separar por funcionalidad:** un commit por feature o cambio lógico (ej. un commit para el código de una feature y otro para cambios en AGENTS.md). Evitar mezclar en un solo commit documentación y código de features distintas.
- Los commits recientes del proyecto siguen esta convención (feat/docs separados) como referencia.

