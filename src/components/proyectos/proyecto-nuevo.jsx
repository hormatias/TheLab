import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function ProyectoNuevo() {
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [clientes, setClientes] = useState([]);
  const [nombreProyecto, setNombreProyecto] = useState("");
  const [descripcionProyecto, setDescripcionProyecto] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [presupuestoProyecto, setPresupuestoProyecto] = useState("");
  const [monedaProyecto, setMonedaProyecto] = useState("EUR");
  const [tipoPresupuestoProyecto, setTipoPresupuestoProyecto] = useState("unico");
  const [frecuenciaRecurrenciaProyecto, setFrecuenciaRecurrenciaProyecto] = useState("mensual");
  const [numeroCuotasProyecto, setNumeroCuotasProyecto] = useState("");
  const [creating, setCreating] = useState(false);

  const proyectosApi = useEntities("proyecto");
  const clientesApi = useEntities("cliente");

  useEffect(() => {
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
      navigate(`/proyectos/${data.id}`);
    } catch (err) {
      console.error("Error al crear proyecto:", err);
      alert(`Error al crear proyecto: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/proyectos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nuevo proyecto</h2>
          <p className="text-muted-foreground">Crea un nuevo proyecto</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del proyecto</CardTitle>
          <CardDescription>Ingresa los datos del proyecto</CardDescription>
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
                ) : isMobile ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  "Crear proyecto"
                )}
              </Button>
              <Button type="button" variant="outline" asChild disabled={creating}>
                <Link to="/proyectos">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
