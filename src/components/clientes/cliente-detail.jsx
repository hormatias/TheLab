import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, FolderOpen, Eye, Users, Plus, Trash2 } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

const EMPTY_MIEMBRO = { nombre: "", rol: "", descripcion: "" };

export function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [cliente, setCliente] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [equipoLocal, setEquipoLocal] = useState([]);
  const [savingEquipo, setSavingEquipo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clientesApi = useEntities("cliente");

  useEffect(() => {
    loadCliente();
    loadProyectos();
  }, [id]);

  // Sincronizar equipo local cuando cambia el cliente cargado (rango → rol por compatibilidad)
  useEffect(() => {
    if (cliente) {
      const equipo = Array.isArray(cliente.equipo) ? cliente.equipo : [];
      setEquipoLocal(
        equipo.map((m) => ({
          ...EMPTY_MIEMBRO,
          ...m,
          rol: m.rol ?? m.rango ?? "",
        }))
      );
    }
  }, [cliente?.id, cliente?.equipo]);

  async function loadCliente() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await clientesApi.get(id);

      if (!data) {
        throw new Error("Cliente no encontrado");
      }

      setCliente(data);
    } catch (err) {
      console.error("Error al cargar cliente:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateEquipoItem(index, field, value) {
    setEquipoLocal((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeEquipoItem(index) {
    setEquipoLocal((prev) => prev.filter((_, i) => i !== index));
  }

  function addEquipoItem() {
    setEquipoLocal((prev) => [...prev, { ...EMPTY_MIEMBRO }]);
  }

  async function saveEquipo() {
    try {
      setSavingEquipo(true);
      const { data } = await clientesApi.update(id, { equipo: equipoLocal });
      setCliente(data);
    } catch (err) {
      console.error("Error al guardar equipo:", err);
      alert(`Error al guardar equipo: ${err.message}`);
    } finally {
      setSavingEquipo(false);
    }
  }

  async function loadProyectos() {
    try {
      // Buscar proyectos que tengan este cliente_id en su data
      const { data, error } = await supabase
        .from("entities")
        .select("id, data")
        .eq("type", "proyecto")
        .filter("data->>cliente_id", "eq", id)
        .order("data->>nombre", { ascending: true });

      if (!error) {
        // Transformar para extraer nombre de data
        const proyectosFormateados = (data || []).map(p => ({
          id: p.id,
          nombre: p.data?.nombre || "Sin nombre"
        }));
        setProyectos(proyectosFormateados);
      }
    } catch (err) {
      console.error("Error al cargar proyectos del cliente:", err);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando cliente...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !cliente) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar cliente</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error || "Cliente no encontrado"}
              </p>
              <Button onClick={() => navigate("/clientes")} className="mt-4" variant="outline">
                Volver a Clientes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/clientes")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{cliente.nombre}</h2>
          <p className="text-muted-foreground">Detalles del cliente</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Proyectos ({proyectos.length})
            </CardTitle>
            <CardDescription>
              Proyectos asociados a este cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proyectos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este cliente no tiene proyectos asignados
              </p>
            ) : (
              <div className="space-y-2">
                {proyectos.map((proyecto) => (
                  <Button
                    key={proyecto.id}
                    variant="outline"
                    className={cn("w-full", isMobile ? "justify-center" : "justify-start")}
                    size={isMobile ? "icon" : "default"}
                    onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                    title={isMobile ? proyecto.nombre : undefined}
                  >
                    {isMobile ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      proyecto.nombre
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Equipo del cliente
            </CardTitle>
            <CardDescription>
              Personas de contacto: nombre, rol y descripción
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {equipoLocal.map((miembro, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:gap-4"
                >
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={miembro.nombre}
                      onChange={(e) => updateEquipoItem(index, "nombre", e.target.value)}
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Rol"
                      value={miembro.rol}
                      onChange={(e) => updateEquipoItem(index, "rol", e.target.value)}
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Descripción"
                      value={miembro.descripcion}
                      onChange={(e) => updateEquipoItem(index, "descripcion", e.target.value)}
                      className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-1"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEquipoItem(index)}
                    aria-label="Quitar del equipo"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addEquipoItem}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir persona
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveEquipo}
                disabled={savingEquipo}
              >
                {savingEquipo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Guardar equipo"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
