# The Lab

## ¿Qué es?
Un proyecto de gestión de laboratorios de código. Personalizado e impulsado con integraciones de frontera.

## ¿Qué son las entities?
Las entidades son una unidad de la aplicación (proyectos, clientes, miembros, formularios, cámaras, notas) vive en **una sola tabla** `entities`.

Puedes crear tu propia entity.

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
  "contenido": "string | null" // Markdown
}
```

## Editores de Markdown

En las pantallas donde se editan campos en Markdown se usa el patrón **vista → Editar → edición**:

- **Por defecto:** modo vista (solo lectura). El contenido se muestra renderizado con `react-markdown`; no se duplica editor y vista previa.
- **Botón "Editar":** pasa al modo edición (textarea con el Markdown en crudo). Guardar persiste y vuelve a vista; Cancelar descarta y vuelve a vista.

Referencia: `nota-detail.jsx` (estado `isEditing`, botón Editar).

## Cómo se usan en código

- **Hook:** `useEntities(tipo)` → devuelve `list`, `get`, `create`, `update`, `remove`, `search`, `subscribe`.
- Las respuestas vienen **aplanadas**: los campos de `data` se exponen al mismo nivel que `id`, `type`, `created_at`, `updated_at` (y `_raw` con el objeto crudo).
- Para relaciones: `getEntityById(type, id)` y `getEntitiesByIds(type, ids)` en `use-entities.js`.

No hay tablas separadas por tipo; todo es `entities` filtrado por `type`.

