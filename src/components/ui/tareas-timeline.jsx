import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  GanttProvider,
  GanttTimeline,
  GanttHeader,
  GanttFeatureList,
  GanttFeatureItem,
  GanttToday,
  GanttPaymentLine,
} from "@/components/ui/gantt";

/**
 * Componente de timeline para visualizar tareas como barras horizontales
 * Usa el componente Gantt interno
 */
export function TareasTimeline({ 
  tareas = [], 
  onMoveTask, 
  className,
  presupuesto,
  moneda,
  tipoPresupuesto,
  frecuenciaRecurrencia,
  numeroCuotas,
  fechasCobroPersonalizadas
}) {
  const tareasConFechas = tareas.filter(t => t.fecha_inicio || t.fecha_fin);
  
  // Handler para mover tareas (drag & drop)
  const handleMoveFeature = (id, startAt, endAt) => {
    if (onMoveTask) {
      const fechaInicio = startAt.toISOString().split('T')[0];
      const fechaFin = endAt.toISOString().split('T')[0];
      onMoveTask(id, fechaInicio, fechaFin);
    }
  };

  // Calcular fechas de inicio y fin del proyecto desde las tareas
  const fechasProyecto = useMemo(() => {
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
  }, [tareas]);

  // Calcular fechas de cobro
  const fechasCobro = useMemo(() => {
    if (!presupuesto || !fechasProyecto.inicio) return [];

    // Si hay fechas personalizadas, usarlas directamente
    if (fechasCobroPersonalizadas && Array.isArray(fechasCobroPersonalizadas) && fechasCobroPersonalizadas.length > 0) {
      const cuotas = Number(numeroCuotas) || 0;
      const totalBase = tipoPresupuesto === "recurrente"
        ? presupuesto * cuotas
        : presupuesto;

      return fechasCobroPersonalizadas.map(cobro => {
        const montoRaw = typeof cobro.monto === "number" ? cobro.monto : parseFloat(cobro.monto);
        const monto = Number.isFinite(montoRaw)
          ? montoRaw
          : totalBase
            ? (totalBase * (cobro.porcentaje || 0)) / 100
            : 0;

        return {
          fecha: new Date(cobro.fecha),
          monto,
          moneda: cobro.moneda || moneda || "EUR"
        };
      });
    }

    const { inicio, fin } = fechasProyecto;

    // Presupuesto único: cobro al final
    if (tipoPresupuesto === "unico" || !tipoPresupuesto) {
      if (fin) {
        return [{
          fecha: fin,
          monto: presupuesto,
          moneda: moneda || "EUR"
        }];
      }
      return [];
    }

    // Presupuesto recurrente: cobros al final de cada período (mismo monto cada período)
    if (tipoPresupuesto === "recurrente") {
      if (!frecuenciaRecurrencia || !numeroCuotas) {
        return [];
      }

      const fechas = [];
      let fechaActual = new Date(inicio);
      const cuotas = numeroCuotas;

      for (let i = 0; i < cuotas; i++) {
        // Primero incrementar para que el cobro sea al final del período
        // personalizado usa mensual como base
        if (frecuenciaRecurrencia === "anual") {
          fechaActual.setFullYear(fechaActual.getFullYear() + 1);
        } else {
          // mensual y personalizado: incremento mensual
          fechaActual.setMonth(fechaActual.getMonth() + 1);
        }

        fechas.push({
          fecha: new Date(fechaActual),
          monto: presupuesto, // En recurrente, presupuesto es el monto por período
          moneda: moneda || "EUR"
        });
      }

      return fechas;
    }

    // Presupuesto fraccionado: divide el presupuesto total en varias cuotas iguales
    if (tipoPresupuesto === "fraccionado") {
      if (!frecuenciaRecurrencia || !numeroCuotas) {
        return [];
      }

      const montoPorCuota = presupuesto / numeroCuotas;
      const fechas = [];
      let fechaActual = new Date(inicio);
      const cuotas = numeroCuotas;

      for (let i = 0; i < cuotas; i++) {
        // Incrementar según frecuencia (personalizado usa mensual como base)
        if (frecuenciaRecurrencia === "anual") {
          fechaActual.setFullYear(fechaActual.getFullYear() + 1);
        } else {
          // mensual y personalizado: incremento mensual
          fechaActual.setMonth(fechaActual.getMonth() + 1);
        }

        fechas.push({
          fecha: new Date(fechaActual),
          monto: montoPorCuota, // En fraccionado, dividimos el total entre las cuotas
          moneda: moneda || "EUR"
        });
      }

      return fechas;
    }

    return [];
  }, [presupuesto, moneda, tipoPresupuesto, frecuenciaRecurrencia, numeroCuotas, fechasProyecto, fechasCobroPersonalizadas]);

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-hidden flex flex-col">
      <GanttProvider 
        className={cn("border rounded-lg w-full flex-1 min-h-0", className)} 
        range="monthly" 
        zoom={100}
        items={tareas}
      >
        <GanttHeader />
        <GanttTimeline>
        <GanttFeatureList>
          {tareas.map((tarea) => (
            <GanttFeatureItem
              key={tarea.id}
              id={tarea.id}
              name={tarea.nombre}
              startAt={tarea.fecha_inicio}
              endAt={tarea.fecha_fin}
              status={tarea.completada ? "completed" : "in_progress"}
              onMove={onMoveTask ? handleMoveFeature : undefined}
            />
          ))}
        </GanttFeatureList>
        
        {/* Líneas de cobro (verdes) */}
        {fechasCobro.map((cobro, index) => (
          <GanttPaymentLine
            key={`pago-${cobro.fecha.toISOString()}-${index}`}
            date={cobro.fecha}
            amount={cobro.monto}
            currency={cobro.moneda}
          />
        ))}
        
        <GanttToday />
      </GanttTimeline>
    </GanttProvider>
    </div>
  );
}
