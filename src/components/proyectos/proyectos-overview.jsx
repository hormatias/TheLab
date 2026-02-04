import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Users, User, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { formatPresupuestoKpi } from "@/lib/utils";

export function ProyectosOverview() {
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const proyectosApi = useEntities("proyecto");
  const clientesApi = useEntities("cliente");
  const miembrosApi = useEntities("miembro");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const [proyectosRes, clientesRes, miembrosRes] = await Promise.all([
        proyectosApi.list({ orderBy: "nombre", ascending: true }),
        clientesApi.list({ orderBy: "nombre", ascending: true }),
        miembrosApi.list({ orderBy: "nombre", ascending: true }),
      ]);

      const clientesData = clientesRes.data || [];
      setClientes(clientesData);
      setMiembros(miembrosRes.data || []);

      const proyectosData = proyectosRes.data || [];
      const proyectosConClientes = await Promise.all(
        proyectosData.map(async (proyecto) => {
          if (proyecto.cliente_id) {
            const cliente = clientesData.find((c) => c.id === proyecto.cliente_id);
            if (cliente) return { ...proyecto, clientes: cliente };
            try {
              const { data: clienteData } = await clientesApi.get(proyecto.cliente_id);
              return { ...proyecto, clientes: clienteData };
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
      setError(
        err?.message?.includes("entities")
          ? "No se encontró la tabla 'entities'. Ejecuta la migración 013."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

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
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium">Error al cargar</p>
            <p className="text-sm text-muted-foreground text-center">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Proyectos</h2>
        <p className="text-muted-foreground">Proyectos, clientes y miembros en una sola vista</p>
      </div>

      {/* Sección Proyectos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Proyectos
          </h3>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/proyectos/lista" className="flex items-center gap-1">
              Ver todos
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {proyectos.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center space-y-2 text-center">
                <FolderOpen className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">No hay proyectos</p>
                <p className="text-xs text-muted-foreground">Ver lista completa para crear uno</p>
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
                    <div className="space-y-0.5 text-left">
                      <CardTitle className="line-clamp-1 text-base font-semibold">
                        {proyecto.nombre || proyecto.name || proyecto.title || "Sin nombre"}
                      </CardTitle>
                      {proyecto.clientes && (
                        <CardDescription className="mt-0">
                          {proyecto.clientes.nombre}
                        </CardDescription>
                      )}
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
      </section>

      {/* Sección Clientes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes
          </h3>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/clientes" className="flex items-center gap-1">
              Ver todos
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {clientes.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center space-y-2 text-center">
                <Users className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">No hay clientes</p>
                <p className="text-xs text-muted-foreground">Ver lista completa para crear uno</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clientes.map((cliente) => (
              <Card
                key={cliente.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/clientes/${cliente.id}`)}
              >
                <CardHeader>
                  <CardTitle className="line-clamp-1 text-base">
                    {cliente.nombre || cliente.name || cliente.title || "Sin nombre"}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Sección Miembros */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5" />
            Miembros
          </h3>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/miembros" className="flex items-center gap-1">
              Ver todos
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {miembros.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center space-y-2 text-center">
                <User className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">No hay miembros</p>
                <p className="text-xs text-muted-foreground">Ver lista completa para crear uno</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {miembros.map((miembro) => (
              <Card
                key={miembro.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/miembros/${miembro.id}`)}
              >
                <CardHeader>
                  <CardTitle className="line-clamp-1 text-base">
                    {miembro.nombre || "Sin nombre"}
                  </CardTitle>
                  {miembro.email && (
                    <CardDescription className="mt-1 line-clamp-1">{miembro.email}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
