import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, Loader2, Image as ImageIcon, ArrowLeft, MapPin, Camera, Clock, AlertCircle } from "lucide-react";
import { useEntities } from "@/hooks/use-entities";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";

export function Camaras() {
  const { isMobile } = useVerticalViewport();
  const camarasApi = useEntities("camara");
  const [camaras, setCamaras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedPueblo, setSelectedPueblo] = useState(null);
  const [refreshKeys, setRefreshKeys] = useState({});
  const [loadingImages, setLoadingImages] = useState({});
  const [lastUpdateTimes, setLastUpdateTimes] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  const loadCamaras = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await camarasApi.list({ orderBy: "nombre", ascending: true });
      setCamaras(data ?? []);
    } catch (err) {
      console.error("Error al cargar cámaras:", err);
      setError(err.message ?? "Error al cargar cámaras");
    } finally {
      setLoading(false);
    }
    // camarasApi estable por tipo; solo ejecutar carga al montar y en retry/actualizar
  }, []);

  useEffect(() => {
    loadCamaras();
  }, [loadCamaras]);

  // Debounce effect para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery) {
        setSelectedPueblo(null); // Limpiar selección al buscar
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Actualizar tiempo actual cada minuto para refrescar los timestamps relativos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, []);

  // Obtener lista de pueblos agrupados
  const pueblosList = useMemo(() => {
    const pueblosMap = new Map();
    const sinUbicacion = [];

    camaras.forEach((camara) => {
      if (camara.pueblo) {
        if (!pueblosMap.has(camara.pueblo)) {
          pueblosMap.set(camara.pueblo, []);
        }
        pueblosMap.get(camara.pueblo).push(camara);
      } else {
        sinUbicacion.push(camara);
      }
    });

    const pueblos = Array.from(pueblosMap.entries())
      .map(([nombre, camarasEnPueblo]) => ({
        nombre,
        count: camarasEnPueblo.length,
        camaras: camarasEnPueblo,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    if (sinUbicacion.length > 0) {
      return [
        {
          nombre: "Sin ubicación específica",
          count: sinUbicacion.length,
          camaras: sinUbicacion,
          isSinUbicacion: true,
        },
        ...pueblos,
      ];
    }

    return pueblos;
  }, [camaras]);

  // Determinar qué cámaras mostrar
  const camarasToShow = useMemo(() => {
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      return camaras.filter((camara) => {
        const nombreMatch = camara.nombre?.toLowerCase().includes(query);
        const parroquiaMatch = camara.parroquia?.toLowerCase().includes(query);
        const puebloMatch = camara.pueblo?.toLowerCase().includes(query);
        return nombreMatch || parroquiaMatch || puebloMatch;
      });
    }

    if (selectedPueblo) {
      if (selectedPueblo === "Sin ubicación específica") {
        return camaras.filter((camara) => !camara.pueblo);
      }
      return camaras.filter((camara) => camara.pueblo === selectedPueblo);
    }

    return [];
  }, [camaras, debouncedSearchQuery, selectedPueblo]);

  // Función para formatear tiempo relativo
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Nunca";
    
    // Usar Date.now() directamente para evitar problemas con currentTime desactualizado
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    
    if (seconds < 0) {
      return "ahora";
    }
    
    if (seconds < 60) {
      return `hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
    }
    
    const days = Math.floor(hours / 24);
    return `hace ${days} ${days === 1 ? "día" : "días"}`;
  };

  // Función para actualizar una imagen individual
  const refreshImage = (camaraId) => {
    const now = Date.now();
    setRefreshKeys((prev) => ({
      ...prev,
      [camaraId]: now,
    }));
    setLastUpdateTimes((prev) => ({
      ...prev,
      [camaraId]: now,
    }));
    setCurrentTime(now); // Actualizar currentTime inmediatamente
  };

  // Función para actualizar todas las imágenes
  const refreshAll = () => {
    const now = Date.now();
    const newKeys = {};
    const newTimes = {};
    camarasToShow.forEach((camara) => {
      newKeys[camara.id] = now;
      newTimes[camara.id] = now;
    });
    setRefreshKeys(newKeys);
    setLastUpdateTimes((prev) => ({ ...prev, ...newTimes }));
    setCurrentTime(now); // Actualizar currentTime inmediatamente
  };

  // Función para volver a la vista de pueblos
  const handleBackToPueblos = () => {
    setSelectedPueblo(null);
    setSearchQuery("");
    setDebouncedSearchQuery("");
  };

  // Manejar carga de imagen
  const handleImageLoad = (camaraId) => {
    setLoadingImages((prev) => ({
      ...prev,
      [camaraId]: false,
    }));
    // Registrar la primera carga como actualización
    setLastUpdateTimes((prev) => {
      if (!prev[camaraId]) {
        return {
          ...prev,
          [camaraId]: Date.now(),
        };
      }
      return prev;
    });
  };

  const handleImageStartLoad = (camaraId) => {
    setLoadingImages((prev) => ({
      ...prev,
      [camaraId]: true,
    }));
  };

  const handleImageError = (camaraId) => {
    setLoadingImages((prev) => ({
      ...prev,
      [camaraId]: false,
    }));
  };

  // Construir URL con timestamp dinámico para forzar recarga
  const getImageUrl = (camara) => {
    const baseUrl = camara.url;
    const refreshKey = refreshKeys[camara.id] || Date.now();
    // Formato del timestamp: YYYYMMDDHHmmss
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    return `${baseUrl}?t=${timestamp}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando cámaras...</span>
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
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar cámaras</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
              <Button onClick={loadCamaras} className="mt-4" variant="outline">
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Cámaras de Tráfico</h2>
        <p className="text-muted-foreground">
          Visualización en tiempo real de las cámaras de tráfico de Andorra
        </p>
      </div>

      {/* Barra de búsqueda y botones */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, parroquia o pueblo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searchQuery && !debouncedSearchQuery && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
              Escribiendo...
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {(selectedPueblo || debouncedSearchQuery) && (
            <Button
              onClick={handleBackToPueblos}
              variant="outline"
              size={isMobile ? "icon" : "default"}
              title="Volver a pueblos"
            >
              <ArrowLeft className={cn("h-4 w-4", !isMobile && "mr-2")} />
              {!isMobile && "Volver a pueblos"}
            </Button>
          )}
          <Button
            onClick={loadCamaras}
            variant="outline"
            size={isMobile ? "icon" : "default"}
            title="Actualizar lista"
          >
            <RefreshCw className={cn("h-4 w-4", !isMobile && "mr-2")} />
            {!isMobile && "Actualizar lista"}
          </Button>
          {camarasToShow.length > 0 && (
            <Button
              onClick={refreshAll}
              variant="outline"
              size={isMobile ? "icon" : "default"}
              title="Actualizar todas"
            >
              <RefreshCw className={cn("h-4 w-4", !isMobile && "mr-2")} />
              {!isMobile && "Actualizar todas"}
            </Button>
          )}
        </div>
      </div>

      {/* Vista de pueblos o cámaras */}
      {camarasToShow.length === 0 && !selectedPueblo && !debouncedSearchQuery ? (
        // Vista de pueblos (por defecto)
        <div>
          <h3 className="text-xl font-semibold mb-4">Selecciona un pueblo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pueblosList.map((pueblo) => (
              <Card
                key={pueblo.nombre}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => setSelectedPueblo(pueblo.nombre)}
              >
                <CardHeader className={cn("pb-3", isMobile && "pb-2")}>
                  <div className="flex items-center gap-2">
                    <MapPin className={cn("text-muted-foreground", isMobile ? "h-6 w-6" : "h-5 w-5")} />
                    <CardTitle className={cn("font-medium", isMobile ? "text-sm" : "text-base")}>
                      {pueblo.nombre}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className={isMobile ? "pt-0" : ""}>
                  <div className={cn("flex items-center gap-2", isMobile ? "text-xs" : "text-sm", "text-muted-foreground")}>
                    <Camera className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
                    <span>
                      {pueblo.count} {pueblo.count === 1 ? "cámara" : "cámaras"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : camarasToShow.length === 0 ? (
        // No se encontraron resultados
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Search className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No se encontraron cámaras</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedPueblo
                    ? `No hay cámaras en ${selectedPueblo}`
                    : "Intenta con otro término de búsqueda"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Grid de cámaras
        <div>
          {selectedPueblo && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Camera className={cn("text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                <h3 className={cn("font-semibold", isMobile ? "text-lg" : "text-xl")}>
                  Cámaras de {selectedPueblo}
                </h3>
              </div>
              <p className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
                {camarasToShow.length} {camarasToShow.length === 1 ? "cámara" : "cámaras"}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {camarasToShow.map((camara) => {
              const isLoading = loadingImages[camara.id] === true;
              const imageUrl = getImageUrl(camara);

              return (
                <Card key={camara.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium line-clamp-2">
                      {camara.nombre}
                    </CardTitle>
                    {(camara.parroquia || camara.pueblo) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {camara.parroquia && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                            {camara.parroquia}
                          </span>
                        )}
                        {camara.pueblo && camara.pueblo !== camara.parroquia && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                            {camara.pueblo}
                          </span>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Contenedor de imagen */}
                    <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      <img
                        src={imageUrl}
                        alt={camara.nombre}
                        loading="lazy"
                        className={cn(
                          "w-full h-full object-cover",
                          isLoading && "opacity-0"
                        )}
                        onLoadStart={() => handleImageStartLoad(camara.id)}
                        onLoad={() => handleImageLoad(camara.id)}
                        onError={() => handleImageError(camara.id)}
                      />
                      {!isLoading && !imageUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Última actualización */}
                    {lastUpdateTimes[camara.id] && (
                      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", isMobile && "text-[10px]")}>
                        <Clock className={cn(isMobile ? "h-3 w-3" : "h-2.5 w-2.5")} />
                        <span>Actualizada {formatTimeAgo(lastUpdateTimes[camara.id])}</span>
                      </div>
                    )}

                    {/* Botón actualizar individual */}
                    <Button
                      onClick={() => refreshImage(camara.id)}
                      variant="outline"
                      size={isMobile ? "default" : "sm"}
                      className="w-full"
                    >
                      <RefreshCw className={cn(isMobile ? "h-4 w-4 mr-2" : "h-3 w-3 mr-2")} />
                      Actualizar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
