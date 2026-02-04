import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, FolderOpen, Eye } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [cliente, setCliente] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clientesApi = useEntities("cliente");

  useEffect(() => {
    loadCliente();
    loadProyectos();
  }, [id]);

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
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre</p>
              <p className="text-lg">{cliente.nombre}</p>
            </div>
            {cliente.id && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p className="text-sm font-mono">{cliente.id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
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
      </div>
    </div>
  );
}
