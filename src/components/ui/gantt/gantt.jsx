import { createContext, useContext, useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Context para compartir estado del Gantt
const GanttContext = createContext(null);

export function useGantt() {
  const context = useContext(GanttContext);
  if (!context) {
    throw new Error("useGantt debe usarse dentro de GanttProvider");
  }
  return context;
}

// Utilidades de fecha

// Parsear fecha string (YYYY-MM-DD) como fecha local, no UTC
// IMPORTANTE: new Date("2026-02-05") interpreta como UTC, causando desfase de 1 día
function parseLocalDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return new Date(dateInput);

  // Si es string en formato YYYY-MM-DD, parsearlo como local
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateInput);
}

function startOfDay(date) {
  const d = parseLocalDate(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const result = parseLocalDate(date);
  result.setDate(result.getDate() + days);
  return result;
}

function diffDays(date1, date2) {
  const d1 = startOfDay(date1);
  const d2 = startOfDay(date2);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function formatDate(date, format) {
  const d = parseLocalDate(date);
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  if (format === "month") {
    return months[d.getMonth()];
  }
  if (format === "day") {
    return d.getDate().toString();
  }
  if (format === "dayName") {
    return days[d.getDay()];
  }
  if (format === "full") {
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return d.toLocaleDateString();
}

// Provider principal
export function GanttProvider({
  children,
  className,
  range = "monthly",
  zoom = 100,
  onAddItem,
  items = [], // Array de items con startAt/endAt o fecha_inicio/fecha_fin
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const containerRef = useRef(null);

  // Calcular rango de fechas basado en los items (tareas)
  const { startDate, endDate, days } = useMemo(() => {
    const today = startOfDay(currentDate);
    let start, end;

    // Extraer todas las fechas de los items
    const allDates = [];
    items.forEach(item => {
      const itemStart = item.startAt || item.fecha_inicio;
      const itemEnd = item.endAt || item.fecha_fin;
      if (itemStart) allDates.push(parseLocalDate(itemStart));
      if (itemEnd) allDates.push(parseLocalDate(itemEnd));
    });

    // Siempre incluir el día de hoy
    allDates.push(today);

    if (allDates.length > 0) {
      // Encontrar fecha mínima y máxima
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

      // Agregar padding de días al rango
      const paddingDays = range === "weekly" ? 7 : range === "monthly" ? 14 : 30;
      start = addDays(startOfDay(minDate), -paddingDays);
      end = addDays(startOfDay(maxDate), paddingDays);

      // Asegurar un mínimo de días visibles
      const minDays = range === "weekly" ? 21 : range === "monthly" ? 45 : 90;
      const currentDays = diffDays(start, end);
      if (currentDays < minDays) {
        const extraDays = Math.ceil((minDays - currentDays) / 2);
        start = addDays(start, -extraDays);
        end = addDays(end, extraDays);
      }
    } else {
      // Fallback: rango por defecto si no hay items
      if (range === "weekly") {
        start = addDays(today, -14);
        end = addDays(today, 14);
      } else if (range === "monthly") {
        start = addDays(today, -30);
        end = addDays(today, 60);
      } else {
        start = addDays(today, -45);
        end = addDays(today, 90);
      }
    }

    const totalDays = diffDays(start, end);
    const daysArray = [];
    for (let i = 0; i <= totalDays; i++) {
      daysArray.push(addDays(start, i));
    }

    return { startDate: start, endDate: end, days: daysArray };
  }, [currentDate, range, items]);

  // Ancho de cada día en píxeles
  const dayWidth = useMemo(() => {
    const baseWidth = range === "weekly" ? 40 : range === "monthly" ? 30 : 20;
    return (baseWidth * zoom) / 100;
  }, [range, zoom]);

  // Navegación
  const goToPrevious = () => {
    const offset = range === "weekly" ? -7 : range === "monthly" ? -30 : -45;
    setCurrentDate(addDays(currentDate, offset));
  };

  const goToNext = () => {
    const offset = range === "weekly" ? 7 : range === "monthly" ? 30 : 45;
    setCurrentDate(addDays(currentDate, offset));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calcular posición de un item
  const getItemPosition = (itemStartDate, itemEndDate) => {
    if (!itemStartDate) return null;

    const start = parseLocalDate(itemStartDate);
    const end = itemEndDate ? parseLocalDate(itemEndDate) : start;

    const startOffset = diffDays(startDate, start);
    const duration = diffDays(start, end) + 1;

    return {
      left: Math.max(0, startOffset * dayWidth),
      width: Math.max(dayWidth, duration * dayWidth),
      isVisible: startOffset + duration > 0 && startOffset < days.length,
    };
  };

  // Calcular fecha desde posición
  const getDateFromPosition = (x) => {
    const dayIndex = Math.floor(x / dayWidth);
    return addDays(startDate, dayIndex);
  };

  // Ancho de columna de nombres (más pequeño para mobile)
  const nameColumnWidth = 120;

  const value = {
    startDate,
    endDate,
    days,
    dayWidth,
    nameColumnWidth,
    currentDate,
    range,
    zoom,
    containerRef,
    goToPrevious,
    goToNext,
    goToToday,
    getItemPosition,
    getDateFromPosition,
    onAddItem,
  };

  return (
    <GanttContext.Provider value={value}>
      <div ref={containerRef} className={cn("bg-background rounded-lg w-full max-w-full flex flex-col", className)} style={{ minWidth: 0 }}>
        {children}
      </div>
    </GanttContext.Provider>
  );
}

// Header con navegación (no scrollea, se queda fijo arriba)
export function GanttHeader({ className }) {
  const { goToPrevious, goToNext, goToToday, currentDate } = useGantt();

  return (
    <div className={cn("flex items-center justify-between px-3 py-2 border-b bg-muted/30", className)}>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={goToPrevious} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToToday} className="h-8 px-2 text-xs">
          Hoy
        </Button>
        <Button variant="outline" size="sm" onClick={goToNext} className="h-8 w-8 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-xs font-medium">
        {formatDate(currentDate, "full")}
      </div>
    </div>
  );
}

// Timeline principal
export function GanttTimeline({ children, className }) {
  const { days, dayWidth, nameColumnWidth } = useGantt();
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const monthHeaderRef = useRef(null);
  const dayHeaderRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const scrollRafRef = useRef(0);

  // Scroll al día actual al montar
  useEffect(() => {
    if (scrollRef.current) {
      const today = new Date();
      const todayIndex = days.findIndex(
        d => d.toDateString() === today.toDateString()
      );
      if (todayIndex > -1) {
        const scrollPosition = todayIndex * dayWidth - scrollRef.current.clientWidth / 3;
        scrollRef.current.scrollLeft = Math.max(0, scrollPosition);
      }
    }
  }, [days, dayWidth]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return undefined;

    const updateScrollVars = () => {
      contentEl.style.setProperty("--gantt-scroll-top", `${scrollEl.scrollTop}px`);
      contentEl.style.setProperty("--gantt-viewport-height", `${scrollEl.clientHeight}px`);
    };

    updateScrollVars();

    const handleScroll = () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      scrollRafRef.current = requestAnimationFrame(updateScrollVars);
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollVars);
    resizeObserver.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Agrupar días por mes para el header
  const months = useMemo(() => {
    const result = [];
    let currentMonth = null;

    days.forEach((day, index) => {
      const monthKey = `${day.getFullYear()}-${day.getMonth()}`;
      if (monthKey !== currentMonth) {
        result.push({
          name: formatDate(day, "month"),
          year: day.getFullYear(),
          startIndex: index,
          days: 1,
        });
        currentMonth = monthKey;
      } else {
        result[result.length - 1].days++;
      }
    });

    return result;
  }, [days]);

  useEffect(() => {
    const monthHeight = monthHeaderRef.current?.offsetHeight ?? 0;
    const dayHeight = dayHeaderRef.current?.offsetHeight ?? 0;
    const totalHeight = monthHeight + dayHeight;
    if (totalHeight && totalHeight !== headerHeight) {
      setHeaderHeight(totalHeight);
    }
  }, [months.length, days.length, headerHeight]);

  const totalWidth = days.length * dayWidth;
  const headerOffset = headerHeight || 64;

  return (
    <div
      ref={scrollRef}
      className={cn("overflow-auto overscroll-contain w-full flex-1 min-h-0", className)}
      style={{
        WebkitOverflowScrolling: 'touch',
        maxWidth: '100%',
        minWidth: 0
      }}
    >
      <div
        ref={contentRef}
        className="relative"
        style={{
          width: totalWidth + nameColumnWidth,
          minWidth: totalWidth + nameColumnWidth,
          "--gantt-header-height": `${headerOffset}px`,
        }}
      >
        {/* Header de meses */}
        <div ref={monthHeaderRef} className="flex border-b sticky top-0 bg-card z-10">
          <div
            className="shrink-0 border-r bg-muted"
            style={{ width: nameColumnWidth }}
          />
          <div className="flex">
            {months.map((month, i) => (
              <div
                key={i}
                className="text-xs font-medium text-muted-foreground py-2 text-center border-r"
                style={{ width: month.days * dayWidth }}
              >
                {month.name} {month.year !== new Date().getFullYear() ? month.year : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Header de días */}
        <div ref={dayHeaderRef} className="flex border-b sticky top-8 bg-card z-10">
          <div
            className="shrink-0 border-r bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
            style={{ width: nameColumnWidth }}
          >
            Tarea
          </div>
          <div className="flex">
            {days.map((day, i) => {
              const isToday = day.toDateString() === new Date().toDateString();
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={i}
                  className={cn(
                    "text-[10px] text-center py-1 border-r flex flex-col items-center justify-center",
                    isToday ? "bg-primary/10 font-bold text-primary" : isWeekend ? "bg-muted" : "bg-background"
                  )}
                  style={{ width: dayWidth }}
                >
                  <span className="text-muted-foreground">{formatDate(day, "dayName").slice(0, 2)}</span>
                  <span>{formatDate(day, "day")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contenido */}
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Lista de features/tareas
export function GanttFeatureList({ children, className }) {
  return (
    <div className={cn("", className)}>
      {children}
    </div>
  );
}

// Grupo de features
export function GanttFeatureListGroup({ children, name, className }) {
  const [collapsed, setCollapsed] = useState(false);

  if (name) {
    return (
      <div className={cn("", className)}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 w-48 border-r border-b"
        >
          <span className={cn("transition-transform", collapsed && "-rotate-90")}>▼</span>
          {name}
        </button>
        {!collapsed && children}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

// Item individual (barra del Gantt)
export function GanttFeatureItem({
  id,
  name,
  startAt,
  endAt,
  status,
  children,
  onMove,
  onClick,
  className,
}) {
  const { days, dayWidth, nameColumnWidth, getItemPosition, startDate } = useGantt();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const itemRef = useRef(null);

  const position = getItemPosition(startAt, endAt);
  const hasPosition = position && position.isVisible;

  // Colores basados en status
  const getStatusColor = () => {
    if (!status) return "bg-primary";
    const colors = {
      planned: "bg-gray-500",
      "in progress": "bg-amber-500",
      "in_progress": "bg-amber-500",
      done: "bg-emerald-500",
      completed: "bg-emerald-500",
    };
    return colors[status.toLowerCase()] || "bg-primary";
  };

  // Drag handlers
  const handleMouseDown = (e) => {
    if (!onMove) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : new Date(startAt),
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!dragStart) return;
      const deltaX = e.clientX - dragStart.x;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (daysDelta !== 0 && itemRef.current) {
        const newStart = addDays(dragStart.startAt, daysDelta);
        const newEnd = addDays(dragStart.endAt, daysDelta);
        // Visual feedback durante el drag
        const newPosition = getItemPosition(newStart, newEnd);
        if (newPosition) {
          itemRef.current.style.left = `${newPosition.left}px`;
        }
      }
    };

    const handleMouseUp = (e) => {
      if (!dragStart || !onMove) return;
      const deltaX = e.clientX - dragStart.x;
      const daysDelta = Math.round(deltaX / dayWidth);

      if (daysDelta !== 0) {
        const newStart = addDays(dragStart.startAt, daysDelta);
        const newEnd = addDays(dragStart.endAt, daysDelta);
        onMove(id, newStart, newEnd);
      }

      setIsDragging(false);
      setDragStart(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, dayWidth, id, onMove, getItemPosition]);

  return (
    <div className="flex border-b hover:bg-muted/20">
      {/* Nombre de la tarea (columna fija) */}
      <div
        className="shrink-0 border-r px-2 py-2 truncate text-sm cursor-pointer hover:bg-muted/50"
        style={{ width: nameColumnWidth }}
        onClick={onClick}
        title={name}
      >
        {name}
      </div>

      {/* Timeline */}
      <div className="flex-1 relative h-10">
        {/* Grid de fondo */}
        <div className="absolute inset-0 flex">
          {days.map((day, i) => {
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={cn(
                  "border-r border-input/30 h-full",
                  isWeekend && "bg-muted/30",
                  isToday && "bg-primary/5"
                )}
                style={{ width: dayWidth }}
              />
            );
          })}
        </div>

        {/* Barra de la tarea */}
        {hasPosition && (
          <div
            ref={itemRef}
            className={cn(
              "absolute top-1.5 h-7 rounded flex items-center px-2 gap-1 cursor-grab active:cursor-grabbing transition-shadow",
              getStatusColor(),
              isDragging && "shadow-lg opacity-80",
              className
            )}
            style={{
              left: position.left,
              width: position.width,
              minWidth: 24,
            }}
            onMouseDown={handleMouseDown}
            title={`${name}: ${startAt} - ${endAt || startAt}`}
          >
            {children || (
              <span className="text-xs text-white truncate">{name}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Marcador de "Hoy"
export function GanttToday({ className }) {
  const { days, dayWidth, nameColumnWidth } = useGantt();

  const todayIndex = days.findIndex(
    d => d.toDateString() === new Date().toDateString()
  );

  if (todayIndex === -1) return null;

  return (
    <div
      className={cn("absolute inset-y-0 z-20 pointer-events-none", className)}
      style={{ left: nameColumnWidth + todayIndex * dayWidth, width: dayWidth }}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-red-500"
        style={{
          top: "calc(var(--gantt-scroll-top, 0px) + var(--gantt-header-height, 64px))",
          height: "calc(var(--gantt-viewport-height, 0px) - var(--gantt-header-height, 64px))",
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-green-500"
        style={{
          top: "calc(var(--gantt-scroll-top, 0px) + var(--gantt-header-height, 64px) - 8px)",
          borderColor: "var(--color-red-500)",
          borderWidth: "4px",
          borderStyle: "solid",
          transform: "translateY(3px) rotate(45deg)",
          transformOrigin: "center",
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap px-1 rounded bg-red-500 text-white font-medium"
        style={{ top: "calc(var(--gantt-scroll-top, 0px) + var(--gantt-header-height, 64px) - 52px)" }}
      >
        Hoy
      </div>
    </div>
  );
}

// Marcador personalizado
export function GanttMarker({ date, label, className, onRemove }) {
  const { days, dayWidth, nameColumnWidth } = useGantt();

  const markerDate = parseLocalDate(date);
  const dayIndex = days.findIndex(
    d => d.toDateString() === markerDate.toDateString()
  );

  if (dayIndex === -1) return null;

  return (
    <div
      className={cn(
        "absolute top-0 flex flex-col items-center z-10",
        className
      )}
      style={{ left: nameColumnWidth + dayIndex * dayWidth + dayWidth / 2 - 4 }}
    >
      <div className="w-2 h-2 rounded-full bg-current" />
      <div className="w-px h-full bg-current opacity-50" />
      {label && (
        <div className="absolute top-3 left-2 text-[10px] whitespace-nowrap px-1 rounded bg-background border">
          {label}
        </div>
      )}
    </div>
  );
}

// Línea de pago (verde, similar a GanttToday)
export function GanttPaymentLine({ date, amount, currency, className }) {
  const { days, dayWidth, nameColumnWidth } = useGantt();

  const paymentDate = parseLocalDate(date);
  const dayIndex = days.findIndex(
    d => d.toDateString() === paymentDate.toDateString()
  );

  if (dayIndex === -1) return null;

  const formattedAmount = amount ? new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) : '';

  return (
    <div
      className={cn("absolute inset-y-0 z-20 pointer-events-none", className)}
      style={{ left: nameColumnWidth + dayIndex * dayWidth, width: dayWidth }}
      title={formattedAmount ? `Cobro: ${formattedAmount}` : 'Fecha de cobro'}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-green-500"
        style={{
          top: "calc(var(--gantt-scroll-top, 0px) + var(--gantt-header-height, 64px))",
          height: "calc(var(--gantt-viewport-height, 0px) - var(--gantt-header-height, 64px))",
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-green-500"
        style={{
          top: "calc(var(--gantt-scroll-top, 0px) + var(--gantt-header-height, 64px) - 8px)",
          borderColor: "var(--color-green-500)",
          borderWidth: "4px",
          borderStyle: "solid",
          transform: "translateY(3px) rotate(45deg)",
          transformOrigin: "center",
        }}
      />
      {formattedAmount && (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap px-1 rounded bg-green-500 text-white font-medium"
          style={{ top: "calc(var(--gantt-scroll-top, 0px) + var(--gantt-header-height, 64px) - 52px)" }}
        >
          {formattedAmount}
        </div>
      )}
    </div>
  );
}
