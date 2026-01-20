import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, FolderOpen, Eye, Mail } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function MiembroDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [miembro, setMiembro] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMiembro();
    loadProyectos();
  }, [id]);

  async function loadMiembro() {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("miembros")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Miembro no encontrado");
        }
        throw error;
      }

      setMiembro(data);
    } catch (err) {
      console.error("Error al cargar miembro:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProyectos() {
    try {
      const { data, error } = await supabase
        .from("proyecto_miembros")
        .select(`
          proyectos (
            id,
            nombre
          )
        `)
        .eq("miembro_id", id);

      if (!error && data) {
        const proyectosData = data
          .map((item) => item.proyectos)
          .filter((p) => p !== null);
        setProyectos(proyectosData);
      }
    } catch (err) {
      console.error("Error al cargar proyectos del miembro:", err);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando miembro...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !miembro) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar miembro</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error || "Miembro no encontrado"}
              </p>
              <Button onClick={() => navigate("/miembros")} className="mt-4" variant="outline">
                Volver a Miembros
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
          onClick={() => navigate("/miembros")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{miembro.nombre}</h2>
          <p className="text-muted-foreground">Detalles del miembro</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Información del Miembro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre</p>
              <p className="text-lg">{miembro.nombre}</p>
            </div>
            {miembro.email && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </p>
                <p className="text-lg">{miembro.email}</p>
              </div>
            )}
            {miembro.id && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p className="text-sm font-mono">{miembro.id}</p>
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
              Proyectos asignados a este miembro
            </CardDescription>
          </CardHeader>
          <CardContent>
            {proyectos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este miembro no tiene proyectos asignados
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
