import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2, AlertCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn, formatPresupuestoKpi } from "@/lib/utils";

export function ProyectosList() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [nombreProyecto, setNombreProyecto] = useState("");
  const [descripcionProyecto, setDescripcionProyecto] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [presupuestoProyecto, setPresupuestoProyecto] = useState("");
  const [monedaProyecto, setMonedaProyecto] = useState("EUR");
  const [tipoPresupuestoProyecto, setTipoPresupuestoProyecto] = useState("unico");
  const [frecuenciaRecurrenciaProyecto, setFrecuenciaRecurrenciaProyecto] = useState("mensual");
  const [numeroCuotasProyecto, setNumeroCuotasProyecto] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Hooks para entidades
  const proyectosApi = useEntities("proyecto");
  const clientesApi = useEntities("cliente");

  useEffect(() => {
    loadProyectos();
    loadClientes();
  }, []);

  async function loadClientes() {
    try {
      const { data } = await clientesApi.list({ orderBy: "nombre", ascending: true });
      setClientes(data || []);
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  }

  async function loadProyectos() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await proyectosApi.list({ orderBy: "nombre", ascending: true });

      // Cargar info de clientes para los proyectos que tienen cliente_id
      const proyectosConClientes = await Promise.all(
        (data || []).map(async (proyecto) => {
          if (proyecto.cliente_id) {
            const clienteData = clientes.find(c => c.id === proyecto.cliente_id);
            if (clienteData) {
              return { ...proyecto, clientes: clienteData };
            }
            // Si no está en cache, cargarlo
            try {
              const { data: cliente } = await clientesApi.get(proyecto.cliente_id);
              return { ...proyecto, clientes: cliente };
            } catch {
              return proyecto;
            }
          }
          return proyecto;
        })
      );

      setProyectos(proyectosConClientes);
    } catch (err) {
      console.error("Error al cargar proyectos:", err);
      if (err.code === "PGRST116" || err.message?.includes("entities")) {
        setError("No se encontró la tabla 'entities'. Por favor, ejecuta la migración 013_create_entities_table.sql");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createProyecto(e) {
    e.preventDefault();
    if (!nombreProyecto.trim()) return;

    try {
      setCreating(true);
      const proyectoData = {
        nombre: nombreProyecto.trim(),
        ...(clienteId && { cliente_id: clienteId }),
        ...(descripcionProyecto.trim() && { descripcion: descripcionProyecto.trim() }),
        ...(presupuestoProyecto.trim() && { presupuesto: parseFloat(presupuestoProyecto.trim()) }),
        moneda: monedaProyecto || "EUR",
        tipo_presupuesto: tipoPresupuestoProyecto || "unico",
        tareas: [],
        miembro_ids: [],
        ...((tipoPresupuestoProyecto === "recurrente" || tipoPresupuestoProyecto === "fraccionado") && {
          frecuencia_recurrencia: frecuenciaRecurrenciaProyecto || null,
          numero_cuotas: numeroCuotasProyecto.trim() ? parseInt(numeroCuotasProyecto.trim()) : null
        })
      };

      const { data } = await proyectosApi.create(proyectoData);

      // Agregar info de cliente si existe
      let proyectoConCliente = data;
      if (clienteId) {
        const cliente = clientes.find(c => c.id === clienteId);
        if (cliente) {
          proyectoConCliente = { ...data, clientes: cliente };
        }
      }

      setProyectos([...proyectos, proyectoConCliente].sort((a, b) => 
        (a.nombre || "").localeCompare(b.nombre || "")
      ));
      setNombreProyecto("");
      setDescripcionProyecto("");
      setClienteId("");
      setPresupuestoProyecto("");
      setMonedaProyecto("EUR");
      setTipoPresupuestoProyecto("unico");
      setFrecuenciaRecurrenciaProyecto("mensual");
      setNumeroCuotasProyecto("");
      setShowForm(false);
    } catch (err) {
      console.error("Error al crear proyecto:", err);
      alert(`Error al crear proyecto: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  const handleDeleteClick = (id, nombre) => {
    setConfirmDelete({ id, nombre });
  };

  const confirmDeleteProyecto = async () => {
    if (!confirmDelete) {
      setConfirmDelete(null);
      return;
    }

    const { id } = confirmDelete;

    try {
      setDeleting(id);
      setConfirmDelete(null);
      
      await proyectosApi.remove(id);

      setProyectos(proyectos.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Error al eliminar proyecto:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando proyectos...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isTableNotFound = error.includes("No se encontró") || 
                           error.includes("schema cache") ||
                           error.includes("PGRST116") ||
                           error.includes("entities");
    
    // Si la tabla no existe, mostrar mensaje
    if (isTableNotFound) {
      return (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div className="text-center max-w-md">
                <p className="font-medium">Tabla no encontrada</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <p className="text-sm text-muted-foreground mt-4">
                  Ejecuta la migración para crear la tabla "entities" en tu base de datos de Supabase.
                </p>
                <Button onClick={loadProyectos} className="mt-4" variant="outline">
                  Reintentar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Otros errores
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar proyectos</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadProyectos} className="mt-4" variant="outline">
                Reintentar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Proyectos</h2>
          <p className="text-muted-foreground">
            {proyectos.length} {proyectos.length === 1 ? "proyecto" : "proyectos"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={loadProyectos} 
            variant="outline" 
            size={isMobile ? "icon" : "sm"}
            title="Actualizar"
          >
            <RefreshCw className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Actualizar"}
          </Button>
          <Button 
            onClick={() => setShowForm(!showForm)} 
            size={isMobile ? "icon" : "sm"}
            title="Nuevo Proyecto"
          >
            <Plus className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Nuevo Proyecto"}
          </Button>
        </div>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Proyecto</CardTitle>
            <CardDescription>
              Ingresa los datos del proyecto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createProyecto} className="space-y-4">
              <div>
                <label htmlFor="nombre" className="text-sm font-medium">
                  Nombre del Proyecto
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={nombreProyecto}
                  onChange={(e) => setNombreProyecto(e.target.value)}
                  placeholder="Mi Proyecto"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                  disabled={creating}
                />
              </div>
              <div>
                <label htmlFor="descripcion" className="text-sm font-medium">
                  Descripción (opcional, Markdown)
                </label>
                <textarea
                  id="descripcion"
                  value={descripcionProyecto}
                  onChange={(e) => setDescripcionProyecto(e.target.value)}
                  placeholder="Escribe una descripción en formato Markdown..."
                  rows={6}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Puedes usar Markdown para formatear el texto
                </p>
              </div>
              <div>
                <label htmlFor="cliente" className="text-sm font-medium">
                  Cliente (opcional)
                </label>
                <select
                  id="cliente"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={creating}
                >
                  <option value="">Sin cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="presupuesto" className="text-sm font-medium">
                    Presupuesto (opcional)
                  </label>
                  <input
                    id="presupuesto"
                    type="number"
                    step="0.01"
                    min="0"
                    value={presupuestoProyecto}
                    onChange={(e) => setPresupuestoProyecto(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={creating}
                  />
                </div>
                <div>
                  <label htmlFor="moneda" className="text-sm font-medium">
                    Moneda
                  </label>
                  <select
                    id="moneda"
                    value={monedaProyecto}
                    onChange={(e) => setMonedaProyecto(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={creating}
                  >
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - Dólar estadounidense</option>
                    <option value="ARS">ARS - Peso argentino</option>
                    <option value="MXN">MXN - Peso mexicano</option>
                    <option value="CLP">CLP - Peso chileno</option>
                    <option value="COP">COP - Peso colombiano</option>
                    <option value="BRL">BRL - Real brasileño</option>
                    <option value="GBP">GBP - Libra esterlina</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="tipo_presupuesto" className="text-sm font-medium">
                  Tipo de Presupuesto
                </label>
                <select
                  id="tipo_presupuesto"
                  value={tipoPresupuestoProyecto}
                  onChange={(e) => setTipoPresupuestoProyecto(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={creating}
                >
                  <option value="unico">Único (pago único)</option>
                  <option value="recurrente">Recurrente (pagos periódicos)</option>
                  <option value="fraccionado">Fraccionado (pago total en cuotas)</option>
                </select>
              </div>
              {(tipoPresupuestoProyecto === "recurrente" || tipoPresupuestoProyecto === "fraccionado") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="frecuencia" className="text-sm font-medium">
                      Frecuencia
                    </label>
                    <select
                      id="frecuencia"
                      value={frecuenciaRecurrenciaProyecto}
                      onChange={(e) => setFrecuenciaRecurrenciaProyecto(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={creating}
                    >
                      <option value="mensual">Mensual</option>
                      <option value="anual">Anual</option>
                      <option value="personalizado">Personalizado</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cuotas" className="text-sm font-medium">
                      Número de Cuotas
                    </label>
                    <input
                      id="cuotas"
                      type="number"
                      min="1"
                      value={numeroCuotasProyecto}
                      onChange={(e) => setNumeroCuotasProyecto(e.target.value)}
                      placeholder="Ej: 12"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={creating}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {tipoPresupuestoProyecto === "recurrente" 
                        ? "Ej: 12 cuotas = 12 períodos."
                        : "Ej: 12 cuotas = dividir el presupuesto total en 12 pagos iguales"}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={creating || !nombreProyecto.trim()}
                  size={isMobile ? "icon" : "default"}
                  title={isMobile ? "Crear Proyecto" : undefined}
                >
                  {creating ? (
                    <>
                      <Loader2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                      {!isMobile && "Creando..."}
                    </>
                  ) : (
                    <>
                      {isMobile ? (
                        <Plus className="h-4 w-4" />
                      ) : (
                        "Crear Proyecto"
                      )}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setNombreProyecto("");
                    setDescripcionProyecto("");
                    setClienteId("");
                    setPresupuestoProyecto("");
                    setMonedaProyecto("EUR");
                    setTipoPresupuestoProyecto("unico");
                    setFrecuenciaRecurrenciaProyecto("mensual");
                    setNumeroCuotasProyecto("");
                  }}
                  disabled={creating}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de proyectos */}
      {proyectos.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay proyectos</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crea tu primer proyecto para comenzar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proyectos.map((proyecto) => {
            const kpi = formatPresupuestoKpi(proyecto)
            return (
              <Card 
                key={proyecto.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/proyectos/${proyecto.id}`)}
              >
                <CardHeader className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0 flex-1 text-left">
                      <CardTitle className="line-clamp-1 text-base font-semibold">
                        {proyecto.nombre || proyecto.name || proyecto.title || "Sin nombre"}
                      </CardTitle>
                      {proyecto.clientes && (
                        <CardDescription className="mt-0">
                          {proyecto.clientes.nombre}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteClick(proyecto.id, proyecto.nombre);
                      }}
                      disabled={deleting === proyecto.id}
                      aria-label="Eliminar proyecto"
                    >
                      {deleting === proyecto.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {kpi ? (
                    <div className="flex items-baseline justify-end gap-1.5 leading-none text-green-600">
                      <span className="text-2xl font-bold tabular-nums tracking-tight">
                        {kpi.main}
                      </span>
                      <span className="text-sm opacity-90">{kpi.sub}</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-end gap-1.5 leading-none">
                      <span className="text-2xl font-bold text-muted-foreground/70">—</span>
                      <span className="text-sm text-muted-foreground">Sin presupuesto</span>
                    </div>
                  )}
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        open={!!confirmDelete}
        onConfirm={confirmDeleteProyecto}
        onCancel={() => setConfirmDelete(null)}
        title="Eliminar Proyecto"
        message={`¿Estás seguro de que quieres eliminar el proyecto "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
