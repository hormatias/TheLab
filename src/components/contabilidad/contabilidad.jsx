import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEntities } from "@/hooks/use-entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  GanttProvider,
  GanttTimeline,
  GanttHeader,
  GanttFeatureList,
  GanttFeatureItem,
  GanttPaymentLine,
  GanttToday,
} from "@/components/ui/gantt";

export function Contabilidad() {
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado para el mes seleccionado en el balance
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date();
    return { año: hoy.getFullYear(), mes: hoy.getMonth() };
  });

  const proyectosApi = useEntities("proyecto");

  useEffect(() => {
    loadProyectos();
  }, []);

  async function loadProyectos() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await proyectosApi.list({ orderBy: "nombre", ascending: true });

      // Filtrar proyectos que tienen presupuesto
      const proyectosConPresupuesto = (data || []).filter(p => p.presupuesto !== null && p.presupuesto !== undefined);

      setProyectos(proyectosConPresupuesto);
    } catch (err) {
      console.error("Error al cargar proyectos:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Calcular fechas de inicio y fin del proyecto
  function calcularFechasProyecto(tareas) {
    if (!tareas || tareas.length === 0) return { inicio: null, fin: null };

    const fechasInicio = tareas
      .map(t => t.fecha_inicio)
      .filter(f => f !== null && f !== undefined && f !== "")
      .map(f => new Date(f));

    const fechasFin = tareas
      .map(t => t.fecha_fin)
      .filter(f => f !== null && f !== undefined && f !== "")
      .map(f => new Date(f));

    // Todas las fechas combinadas para encontrar el fin real del proyecto
    const todasLasFechas = [...fechasInicio, ...fechasFin];

    if (todasLasFechas.length === 0) {
      return { inicio: null, fin: null };
    }

    // Inicio: la fecha más temprana de todas
    const inicio = new Date(Math.min(...todasLasFechas.map(d => d.getTime())));
    
    // Fin: la fecha más lejana de todas (fecha_fin si existe, sino fecha_inicio)
    const fin = new Date(Math.max(...todasLasFechas.map(d => d.getTime())));

    return { inicio, fin };
  }

  // Calcular fechas de cobro según tipo de presupuesto
  function calcularFechasCobro(proyecto, fechaInicio, fechaFin) {
    if (!proyecto.presupuesto) return [];

    // Si hay fechas personalizadas, usarlas directamente
    if (proyecto.fechas_cobro_personalizadas && Array.isArray(proyecto.fechas_cobro_personalizadas) && proyecto.fechas_cobro_personalizadas.length > 0) {
      const cuotas = proyecto.numero_cuotas || 0;
      const totalBase = proyecto.tipo_presupuesto === "recurrente"
        ? proyecto.presupuesto * cuotas
        : proyecto.presupuesto;

      return proyecto.fechas_cobro_personalizadas.map(cobro => {
        const montoRaw = typeof cobro.monto === "number" ? cobro.monto : parseFloat(cobro.monto);
        const monto = Number.isFinite(montoRaw)
          ? montoRaw
          : totalBase
            ? (totalBase * (cobro.porcentaje || 0)) / 100
            : 0;

        return {
          fecha: new Date(cobro.fecha),
          monto,
          moneda: cobro.moneda || proyecto.moneda || "EUR"
        };
      });
    }

    // Presupuesto único: cobro al final
    if (proyecto.tipo_presupuesto === "unico" || !proyecto.tipo_presupuesto) {
      if (fechaFin) {
        return [{
          fecha: fechaFin,
          monto: proyecto.presupuesto,
          moneda: proyecto.moneda || "EUR"
        }];
      }
      return [];
    }

    // Presupuesto recurrente: cobros al final de cada período (mismo monto cada período)
    if (proyecto.tipo_presupuesto === "recurrente") {
      if (!fechaInicio || !proyecto.frecuencia_recurrencia || !proyecto.numero_cuotas) {
        return [];
      }

      const fechasCobro = [];
      let fechaActual = new Date(fechaInicio);
      const cuotas = proyecto.numero_cuotas;

      for (let i = 0; i < cuotas; i++) {
        // Primero incrementar para que el cobro sea al final del período
        // personalizado usa mensual como base
        if (proyecto.frecuencia_recurrencia === "anual") {
          fechaActual.setFullYear(fechaActual.getFullYear() + 1);
        } else {
          // mensual y personalizado: incremento mensual
          fechaActual.setMonth(fechaActual.getMonth() + 1);
        }

        fechasCobro.push({
          fecha: new Date(fechaActual),
          monto: proyecto.presupuesto, // En recurrente, presupuesto es el monto por período
          moneda: proyecto.moneda || "EUR"
        });
      }

      return fechasCobro;
    }

    // Presupuesto fraccionado: divide el presupuesto total en varias cuotas iguales
    if (proyecto.tipo_presupuesto === "fraccionado") {
      if (!fechaInicio || !proyecto.frecuencia_recurrencia || !proyecto.numero_cuotas) {
        return [];
      }

      const montoPorCuota = proyecto.presupuesto / proyecto.numero_cuotas;
      const fechasCobro = [];
      let fechaActual = new Date(fechaInicio);
      const cuotas = proyecto.numero_cuotas;

      for (let i = 0; i < cuotas; i++) {
        // Incrementar según frecuencia (personalizado usa mensual como base)
        if (proyecto.frecuencia_recurrencia === "anual") {
          fechaActual.setFullYear(fechaActual.getFullYear() + 1);
        } else {
          // mensual y personalizado: incremento mensual
          fechaActual.setMonth(fechaActual.getMonth() + 1);
        }

        fechasCobro.push({
          fecha: new Date(fechaActual),
          monto: montoPorCuota, // En fraccionado, dividimos el total entre las cuotas
          moneda: proyecto.moneda || "EUR"
        });
      }

      return fechasCobro;
    }

    return [];
  }

  // Procesar proyectos para el Gantt
  const proyectosProcesados = useMemo(() => {
    return proyectos
      .map(proyecto => {
        const tareas = proyecto.tareas || [];
        const { inicio, fin } = calcularFechasProyecto(tareas);

        // Solo incluir proyectos con fechas válidas
        if (!inicio && !fin) return null;

        const fechasCobro = calcularFechasCobro(proyecto, inicio, fin);

        return {
          id: proyecto.id,
          nombre: proyecto.nombre,
          fechaInicio: inicio,
          fechaFin: fin || inicio, // Si no hay fin, usar inicio
          fechasCobro,
          presupuesto: proyecto.presupuesto,
          moneda: proyecto.moneda || "EUR",
          tipoPresupuesto: proyecto.tipo_presupuesto || "unico"
        };
      })
      .filter(p => p !== null);
  }, [proyectos]);

  // Obtener todos los items para el Gantt (proyectos)
  const ganttItems = useMemo(() => {
    return proyectosProcesados.map(p => ({
      id: p.id,
      startAt: p.fechaInicio,
      endAt: p.fechaFin
    }));
  }, [proyectosProcesados]);

  // Obtener todas las fechas de cobro
  const todasFechasCobro = useMemo(() => {
    const fechas = [];
    proyectosProcesados.forEach(proyecto => {
      proyecto.fechasCobro.forEach(cobro => {
        fechas.push({
          ...cobro,
          proyectoId: proyecto.id,
          proyectoNombre: proyecto.nombre
        });
      });
    });
    return fechas;
  }, [proyectosProcesados]);

  // Obtener último día del mes seleccionado
  const ultimoDiaDelMes = useMemo(() => {
    return new Date(mesSeleccionado.año, mesSeleccionado.mes + 1, 0);
  }, [mesSeleccionado]);

  // Calcular income acumulado hasta el último día del mes seleccionado
  const incomeAcumulado = useMemo(() => {
    const fechaReferencia = new Date(ultimoDiaDelMes);
    fechaReferencia.setHours(23, 59, 59, 999); // Fin del último día del mes
    const incomePorMoneda = {};
    
    todasFechasCobro.forEach(cobro => {
      // Comparar fechas normalizadas (solo día, mes, año)
      const fechaCobro = new Date(cobro.fecha);
      fechaCobro.setHours(0, 0, 0, 0);
      const fechaRef = new Date(fechaReferencia);
      fechaRef.setHours(0, 0, 0, 0);
      
      if (fechaCobro <= fechaRef) {
        const moneda = cobro.moneda || 'EUR';
        incomePorMoneda[moneda] = (incomePorMoneda[moneda] || 0) + cobro.monto;
      }
    });
    
    return incomePorMoneda;
  }, [todasFechasCobro, ultimoDiaDelMes]);

  // Funciones de navegación de mes
  const mesAnterior = () => {
    setMesSeleccionado(prev => {
      if (prev.mes === 0) {
        return { año: prev.año - 1, mes: 11 };
      }
      return { año: prev.año, mes: prev.mes - 1 };
    });
  };

  const mesSiguiente = () => {
    setMesSeleccionado(prev => {
      if (prev.mes === 11) {
        return { año: prev.año + 1, mes: 0 };
      }
      return { año: prev.año, mes: prev.mes + 1 };
    });
  };

  const irAHoy = () => {
    const hoy = new Date();
    setMesSeleccionado({ año: hoy.getFullYear(), mes: hoy.getMonth() });
  };

  // Formatear mes y año para el título
  const formatearMesAño = (año, mes) => {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `${meses[mes]} ${año}`;
  };

  // Verificar si el mes seleccionado es el mes actual
  const esMesActual = () => {
    const hoy = new Date();
    return mesSeleccionado.año === hoy.getFullYear() && mesSeleccionado.mes === hoy.getMonth();
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
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar proyectos</p>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (proyectosProcesados.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contabilidad</h2>
          <p className="text-muted-foreground">Vista de presupuestos y fechas de cobro</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No hay proyectos con presupuesto</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Los proyectos deben tener presupuesto y tareas con fechas para aparecer aquí
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Contabilidad</h2>
        <p className="text-muted-foreground">
          Vista de presupuestos y fechas de cobro de {proyectosProcesados.length} proyecto{proyectosProcesados.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Card de Balance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={mesAnterior}
              className="shrink-0"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center">
              <CardTitle>
                Balance al día {ultimoDiaDelMes.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}
              </CardTitle>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-sm font-normal text-muted-foreground">
                  {formatearMesAño(mesSeleccionado.año, mesSeleccionado.mes)}
                </span>
                {!esMesActual() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={irAHoy}
                    className="h-6 px-2 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                    title="Volver al mes actual"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Volver a hoy
                  </Button>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={mesSiguiente}
              className="shrink-0"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Sección Income */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Income</h3>
              {Object.keys(incomeAcumulado).length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay income acumulado hasta la fecha</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(incomeAcumulado).map(([moneda, total]) => (
                    <div
                      key={moneda}
                      className="flex items-center justify-between p-3 rounded-md border border-input bg-muted/50"
                    >
                      <span className="text-sm font-medium">{moneda}</span>
                      <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {new Intl.NumberFormat('es-ES', {
                          style: 'currency',
                          currency: moneda,
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }).format(total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Sección Expenses - preparada para futuro */}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Gantt de Proyectos y Cobros</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <GanttProvider
            className="border rounded-lg w-full"
            range="monthly"
            zoom={100}
            items={ganttItems}
          >
            <GanttHeader />
            <GanttTimeline>
              <GanttFeatureList>
                {proyectosProcesados.map((proyecto) => (
                  <GanttFeatureItem
                    key={proyecto.id}
                    id={proyecto.id}
                    name={proyecto.nombre}
                    startAt={proyecto.fechaInicio}
                    endAt={proyecto.fechaFin}
                    status="in_progress"
                    onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                    className="cursor-pointer"
                  />
                ))}
              </GanttFeatureList>
              
              {/* Líneas de cobro (verdes) */}
              {todasFechasCobro.map((cobro, index) => (
                <GanttPaymentLine
                  key={`${cobro.proyectoId}-${cobro.fecha.toISOString()}-${index}`}
                  date={cobro.fecha}
                  amount={cobro.monto}
                  currency={cobro.moneda}
                />
              ))}
              
              {/* Línea de hoy */}
              <GanttToday />
            </GanttTimeline>
          </GanttProvider>
        </CardContent>
      </Card>
    </div>
  );
}
