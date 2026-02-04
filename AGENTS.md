# Guía para agentes: Entities

## Qué son las entities

Todo el dominio (proyectos, clientes, miembros, formularios, cámaras) vive en **una sola tabla** `entities`. Cada fila tiene:

- **id** (UUID)
- **type** – tipo de entidad (string)
- **data** – JSONB con los campos propios de ese tipo
- **created_at**, **updated_at**

Así se unificó lo que antes eran varias tablas (proyectos, clientes, miembros, formularios, etc.) en un único modelo flexible.

## Tipos de entidad y campos de `data` (JSON)

Cada tipo tiene su `data` como JSONB. Estructura por tipo:

### proyecto

```json
{
  "nombre": "string",
  "descripcion": "string | null",
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
  "descripcion": "string | null",
  "equipo": [
    {
      "nombre": "string",
      "rol": "string",
      "descripcion": "string"
    }
  ]
}
```

Si `tipo_cliente` es `"particular"`, el cliente no tiene equipo (la UI no muestra ni edita `equipo`; se guarda como `[]`) y sí tiene `descripcion`.

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
  "descripcion": "string | null",
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

## Cómo se usan en código

- **Hook:** `useEntities(tipo)` → devuelve `list`, `get`, `create`, `update`, `remove`, `search`, `subscribe`.
- Las respuestas vienen **aplanadas**: los campos de `data` se exponen al mismo nivel que `id`, `type`, `created_at`, `updated_at` (y `_raw` con el objeto crudo).
- Para relaciones: `getEntityById(type, id)` y `getEntitiesByIds(type, ids)` en `use-entities.js`.

No hay tablas separadas por tipo; todo es `entities` filtrado por `type`.
