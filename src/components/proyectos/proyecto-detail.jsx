import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEntities, getEntitiesByIds } from "@/hooks/use-entities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PercentageSlider } from "@/components/ui/percentage-slider";
import { Loader2, AlertCircle, ArrowLeft, User, Users, Eye, Edit2, Save, X, UserPlus, UserMinus, CheckSquare, Square, Plus, Trash2, ListTodo, Building2, Sparkles, Calendar, GanttChart, List, DollarSign, Lock, Unlock } from "lucide-react";
import { useVerticalViewport } from "@/hooks/use-vertical-viewport";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { queryDeepSeek } from "@/lib/deepseek";
import { AIDialog } from "@/components/ui/ai-dialog";
import { TareasTimeline } from "@/components/ui/tareas-timeline";

export function ProyectoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useVerticalViewport();
  const [proyecto, setProyecto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDescripcion, setEditingDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [miembros, setMiembros] = useState([]);
  const [todosLosMiembros, setTodosLosMiembros] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(null);
  const [todosLosClientes, setTodosLosClientes] = useState([]);
  const [showAddCliente, setShowAddCliente] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [addingCliente, setAddingCliente] = useState(false);
  const [removingCliente, setRemovingCliente] = useState(false);
  const [tareas, setTareas] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [creatingTarea, setCreatingTarea] = useState(false);
  const [updatingTarea, setUpdatingTarea] = useState(null);
  const [deletingTarea, setDeletingTarea] = useState(null);
  const [showAIResponse, setShowAIResponse] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [generandoTareas, setGenerandoTareas] = useState(false);
  const [eliminandoTodas, setEliminandoTodas] = useState(false);
  const [vistaTimeline, setVistaTimeline] = useState(() => {
    const saved = localStorage.getItem('tareas-vista-timeline');
    return saved === 'true';
  });
  const [editingPresupuesto, setEditingPresupuesto] = useState(false);
  const [presupuestoValue, setPresupuestoValue] = useState("");
  const [monedaValue, setMonedaValue] = useState("EUR");
  const [tipoPresupuesto, setTipoPresupuesto] = useState("unico");
  const [frecuenciaRecurrencia, setFrecuenciaRecurrencia] = useState("mensual");
  const [numeroCuotas, setNumeroCuotas] = useState("");
  const [fechasCobroPersonalizadas, setFechasCobroPersonalizadas] = useState([]);
  const [personalizandoFechas, setPersonalizandoFechas] = useState(false);
  const [savingPresupuesto, setSavingPresupuesto] = useState(false);
  const [fechaInicioPrimerPago, setFechaInicioPrimerPago] = useState("");

  // Hooks para entidades
  const proyectosApi = useEntities("proyecto");
  const clientesApi = useEntities("cliente");
  const miembrosApi = useEntities("miembro");

  useEffect(() => {
    loadProyecto();
    loadTodosLosMiembros();
    loadTodosLosClientes();
  }, [id]);

  useEffect(() => {
    localStorage.setItem('tareas-vista-timeline', vistaTimeline.toString());
  }, [vistaTimeline]);

  async function loadProyecto() {
    try {
      setLoading(true);
      setError(null);

      const { data } = await proyectosApi.get(id);

      if (!data) {
        throw new Error("Proyecto no encontrado");
      }

      // Cargar cliente si existe
      let clienteData = null;
      if (data.cliente_id) {
        try {
          const { data: cliente } = await clientesApi.get(data.cliente_id);
          clienteData = cliente;
        } catch (err) {
          console.warn("No se pudo cargar el cliente:", err);
        }
      }

      // Cargar miembros si existen
      let miembrosData = [];
      if (data.miembro_ids && data.miembro_ids.length > 0) {
        try {
          const { data: miembrosResult } = await getEntitiesByIds("miembro", data.miembro_ids);
          miembrosData = miembrosResult || [];
        } catch (err) {
          console.warn("No se pudieron cargar los miembros:", err);
        }
      }

      const proyectoCompleto = {
        ...data,
        clientes: clienteData
      };

      setProyecto(proyectoCompleto);
      setMiembros(miembrosData);
      setEditingDescripcion(data.descripcion || "");
      setPresupuestoValue(data.presupuesto?.toString() || "");
      setMonedaValue(data.moneda || "EUR");
      setTipoPresupuesto(data.tipo_presupuesto || "unico");
      setFrecuenciaRecurrencia(data.frecuencia_recurrencia || "mensual");
      setNumeroCuotas(data.numero_cuotas?.toString() || "");
      setFechasCobroPersonalizadas(data.fechas_cobro_personalizadas || []);
      // Solo activar personalización si la frecuencia es "personalizado"
      setPersonalizandoFechas(
        data.frecuencia_recurrencia === "personalizado" 
        && data.fechas_cobro_personalizadas 
        && data.fechas_cobro_personalizadas.length > 0
      );
      setTareas(data.tareas || []);
      
      // Cargar fecha de inicio del primer pago, o usar la fecha de inicio del proyecto si existe
      const tareasData = data.tareas || [];
      const fechaInicioProyecto = tareasData.length > 0
        ? tareasData
            .map(t => t.fecha_inicio)
            .filter(f => f !== null && f !== undefined && f !== "")
            .map(f => new Date(f))
            .sort((a, b) => a.getTime() - b.getTime())[0]
        : null;
      const fechaInicioDefault = fechaInicioProyecto
        ? fechaInicioProyecto.toISOString().split('T')[0]
        : "";
      setFechaInicioPrimerPago(data.fecha_inicio_primer_pago || fechaInicioDefault);
    } catch (err) {
      console.error("Error al cargar proyecto:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTodosLosMiembros() {
    try {
      const { data } = await miembrosApi.list({ orderBy: "nombre", ascending: true });
      setTodosLosMiembros(data || []);
    } catch (err) {
      console.error("Error al cargar todos los miembros:", err);
    }
  }

  async function loadTodosLosClientes() {
    try {
      const { data } = await clientesApi.list({ orderBy: "nombre", ascending: true });
      setTodosLosClientes(data || []);
    } catch (err) {
      console.error("Error al cargar todos los clientes:", err);
    }
  }

  async function addMiembro() {
    if (!selectedMemberId || !proyecto) return;

    try {
      setAddingMember(true);

      // Agregar el miembro_id al array de miembro_ids
      const nuevosMiembroIds = [...(proyecto.miembro_ids || []), selectedMemberId];

      await proyectosApi.update(id, { miembro_ids: nuevosMiembroIds });

      // Actualizar estado local
      const nuevoMiembro = todosLosMiembros.find(m => m.id === selectedMemberId);
      if (nuevoMiembro) {
        setMiembros([...miembros, nuevoMiembro]);
      }
      setProyecto({ ...proyecto, miembro_ids: nuevosMiembroIds });
      setSelectedMemberId("");
      setShowAddMember(false);
    } catch (err) {
      console.error("Error al agregar miembro:", err);
      alert(`Error al agregar miembro: ${err.message}`);
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMiembro(miembroId) {
    if (!proyecto) return;

    try {
      setRemovingMember(miembroId);

      // Remover el miembro_id del array
      const nuevosMiembroIds = (proyecto.miembro_ids || []).filter(id => id !== miembroId);

      await proyectosApi.update(id, { miembro_ids: nuevosMiembroIds });

      setMiembros(miembros.filter(m => m.id !== miembroId));
      setProyecto({ ...proyecto, miembro_ids: nuevosMiembroIds });
    } catch (err) {
      console.error("Error al remover miembro:", err);
      alert(`Error al remover miembro: ${err.message}`);
    } finally {
      setRemovingMember(null);
    }
  }

  async function addCliente() {
    if (!selectedClienteId || !proyecto) return;

    try {
      setAddingCliente(true);

      await proyectosApi.update(id, { cliente_id: selectedClienteId });

      const cliente = todosLosClientes.find(c => c.id === selectedClienteId);
      setProyecto({ ...proyecto, cliente_id: selectedClienteId, clientes: cliente });
      setSelectedClienteId("");
      setShowAddCliente(false);
    } catch (err) {
      console.error("Error al agregar cliente:", err);
      alert(`Error al agregar cliente: ${err.message}`);
    } finally {
      setAddingCliente(false);
    }
  }

  async function removeCliente() {
    if (!proyecto) return;

    try {
      setRemovingCliente(true);

      await proyectosApi.update(id, { cliente_id: null });

      setProyecto({ ...proyecto, cliente_id: null, clientes: null });
    } catch (err) {
      console.error("Error al remover cliente:", err);
      alert(`Error al remover cliente: ${err.message}`);
    } finally {
      setRemovingCliente(false);
    }
  }

  async function updateDescripcion() {
    if (!proyecto) return;

    try {
      setSaving(true);

      await proyectosApi.update(id, { descripcion: editingDescripcion.trim() || null });

      setProyecto({ ...proyecto, descripcion: editingDescripcion.trim() || null });
      setIsEditing(false);
    } catch (err) {
      console.error("Error al actualizar descripción:", err);
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditingDescripcion(proyecto?.descripcion || "");
    setIsEditing(false);
  }

  async function updatePresupuesto() {
    if (!proyecto) return;

    try {
      setSavingPresupuesto(true);
      const presupuestoNum = presupuestoValue.trim() ? parseFloat(presupuestoValue.trim()) : null;
      const cuotasNum = (tipoPresupuesto === "recurrente" || tipoPresupuesto === "fraccionado") && numeroCuotas.trim()
        ? parseInt(numeroCuotas.trim())
        : null;
      const cuotasPersonalizadas = cuotasNum || fechasCobroPersonalizadas.length || 0;
      const tienePresupuesto = presupuestoNum !== null && !Number.isNaN(presupuestoNum);
      const totalBase = obtenerTotalBase(presupuestoNum || 0, cuotasPersonalizadas, tipoPresupuesto);
      const fechasPersonalizadas = frecuenciaRecurrencia === "personalizado"
        && personalizandoFechas
        && fechasCobroPersonalizadas.length > 0
        && tienePresupuesto
        && cuotasPersonalizadas
        ? (() => {
          const porcentajes = obtenerPorcentajesActuales(
            fechasCobroPersonalizadas,
            totalBase,
            cuotasPersonalizadas
          );
          return fechasCobroPersonalizadas.map((cobro, index) => ({
            ...cobro,
            porcentaje: porcentajes[index],
            monto: totalBase ? (totalBase * porcentajes[index]) / 100 : 0,
            moneda: monedaValue || "EUR"
          }));
        })()
        : null;

      const updateData = {
        presupuesto: presupuestoNum,
        moneda: monedaValue || "EUR",
        tipo_presupuesto: tipoPresupuesto || "unico",
        frecuencia_recurrencia: (tipoPresupuesto === "recurrente" || tipoPresupuesto === "fraccionado") ? (frecuenciaRecurrencia || null) : null,
        numero_cuotas: cuotasNum,
        fecha_inicio_primer_pago: (tipoPresupuesto === "recurrente" || tipoPresupuesto === "fraccionado") && frecuenciaRecurrencia !== "personalizado" ? (fechaInicioPrimerPago || null) : null,
        fechas_cobro_personalizadas: fechasPersonalizadas
      };

      await proyectosApi.update(id, updateData);

      setProyecto({
        ...proyecto,
        ...updateData
      });
      setEditingPresupuesto(false);
    } catch (err) {
      console.error("Error al actualizar presupuesto:", err);
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSavingPresupuesto(false);
    }
  }

  function handleCancelEditPresupuesto() {
    setPresupuestoValue(proyecto?.presupuesto?.toString() || "");
    setMonedaValue(proyecto?.moneda || "EUR");
    setTipoPresupuesto(proyecto?.tipo_presupuesto || "unico");
    setFrecuenciaRecurrencia(proyecto?.frecuencia_recurrencia || "mensual");
    setNumeroCuotas(proyecto?.numero_cuotas?.toString() || "");
    setFechasCobroPersonalizadas(proyecto?.fechas_cobro_personalizadas || []);
    // Solo activar personalización si la frecuencia es "personalizado"
    setPersonalizandoFechas(
      proyecto?.frecuencia_recurrencia === "personalizado"
      && proyecto?.fechas_cobro_personalizadas
      && proyecto.fechas_cobro_personalizadas.length > 0
    );
    // Restaurar fecha de inicio del primer pago
    const tareasData = proyecto?.tareas || [];
    const fechaInicioProyecto = tareasData.length > 0
      ? tareasData
          .map(t => t.fecha_inicio)
          .filter(f => f !== null && f !== undefined && f !== "")
          .map(f => new Date(f))
          .sort((a, b) => a.getTime() - b.getTime())[0]
      : null;
    const fechaInicioDefault = fechaInicioProyecto
      ? fechaInicioProyecto.toISOString().split('T')[0]
      : "";
    setFechaInicioPrimerPago(proyecto?.fecha_inicio_primer_pago || fechaInicioDefault);
    setEditingPresupuesto(false);
  }

  function calcularPresupuestoTotal() {
    if (!proyecto?.presupuesto) {
      return proyecto?.presupuesto;
    }

    // Recurrente: presupuesto es monto por período, total = presupuesto * numero_cuotas
    if (proyecto.tipo_presupuesto === "recurrente") {
      const cuotas = proyecto.numero_cuotas || 1;
      return proyecto.presupuesto * cuotas;
    }

    // Fraccionado: presupuesto ya es el total, retornar tal cual
    // Único: presupuesto es el total
    return proyecto.presupuesto;
  }

  function calcularMontoPorCuota() {
    if (!proyecto?.presupuesto || proyecto.tipo_presupuesto !== "fraccionado") {
      return null;
    }

    const cuotas = proyecto.numero_cuotas || 1;
    return proyecto.presupuesto / cuotas;
  }

  function getFrecuenciaLabel() {
    const frecuencia = proyecto?.frecuencia_recurrencia;
    const labels = {
      mensual: "mes",
      anual: "año",
      personalizado: "cuota"
    };
    return labels[frecuencia] || "período";
  }

  function obtenerTotalBase(presupuestoNum, cuotasNum, tipo) {
    if (!presupuestoNum || !cuotasNum) return 0;
    return tipo === "recurrente" ? presupuestoNum * cuotasNum : presupuestoNum;
  }

  function redondearPorcentajes(porcentajes, indexAjuste = null) {
    const redondeados = porcentajes.map((p) => Math.round(p * 100) / 100);
    const total = redondeados.reduce((sum, p) => sum + p, 0);
    const ajuste = Math.round((100 - total) * 100) / 100;

    if (redondeados.length === 0 || Math.abs(ajuste) < 0.001) {
      return redondeados;
    }

    let targetIndex = indexAjuste;
    if (targetIndex === null || targetIndex < 0 || targetIndex >= redondeados.length) {
      targetIndex = redondeados.length - 1;
    }

    redondeados[targetIndex] = Math.max(
      0,
      Math.round((redondeados[targetIndex] + ajuste) * 100) / 100
    );

    return redondeados;
  }

  function normalizarPorcentajes(porcentajes) {
    if (!porcentajes || porcentajes.length === 0) return [];

    const total = porcentajes.reduce((sum, p) => sum + p, 0);
    if (!total) {
      const base = 100 / porcentajes.length;
      return redondearPorcentajes(porcentajes.map(() => base));
    }

    const normalizados = porcentajes.map((p) => (p / total) * 100);
    return redondearPorcentajes(normalizados);
  }

  function obtenerPorcentajesActuales(cobros, totalBase, cuotasNum) {
    const base = cuotasNum ? 100 / cuotasNum : 0;
    const porcentajes = cobros.map((cobro) => {
      if (typeof cobro.porcentaje === "number") return cobro.porcentaje;
      if (typeof cobro.monto === "number" && totalBase > 0) {
        return (cobro.monto / totalBase) * 100;
      }
      return base;
    });

    return normalizarPorcentajes(porcentajes);
  }

  function distribuirPorcentajes(porcentajes, index, nuevoPorcentaje, fijados = []) {
    if (!porcentajes || porcentajes.length === 0) return [];
    if (porcentajes.length === 1) return [100];

    const nuevo = Math.min(100, Math.max(0, nuevoPorcentaje));
    
    // Calcular el total de porcentajes fijados (excluyendo el que se está ajustando)
    const totalFijados = porcentajes.reduce(
      (sum, p, i) => (i !== index && fijados[i] ? sum + p : sum),
      0
    );
    
    // El restante disponible para distribuir entre las no fijadas
    const restante = 100 - nuevo - totalFijados;
    
    // Contar cuántas cuotas no están fijadas (excluyendo la que se está ajustando)
    const cuotasNoFijadas = porcentajes.filter((_, i) => i !== index && !fijados[i]).length;
    
    // Si no hay cuotas no fijadas para ajustar, ajustar solo la actual
    if (cuotasNoFijadas === 0) {
      const nuevos = [...porcentajes];
      nuevos[index] = nuevo;
      return redondearPorcentajes(nuevos, index);
    }

    const totalOtrosNoFijados = porcentajes.reduce(
      (sum, p, i) => (i !== index && !fijados[i] ? sum + p : sum),
      0
    );

    const nuevos = porcentajes.map((p, i) => {
      if (i === index) return nuevo;
      if (fijados[i]) return p; // Mantener fijadas
      if (totalOtrosNoFijados > 0) return (p / totalOtrosNoFijados) * restante;
      return restante / cuotasNoFijadas;
    });

    const indexAjuste = index === nuevos.length - 1 ? nuevos.length - 2 : nuevos.length - 1;
    return redondearPorcentajes(nuevos, indexAjuste);
  }

  // Generar fechas automáticas basándose en frecuencia y número de cuotas
  function generarFechasAutomaticas() {
    // Usar fechaInicioPrimerPago si está disponible, sino usar fecha de inicio de tareas
    let fechaInicio = null;
    
    if (fechaInicioPrimerPago) {
      fechaInicio = new Date(fechaInicioPrimerPago);
    } else if (tareas && tareas.length > 0) {
      const fechasInicio = tareas
        .map(t => t.fecha_inicio)
        .filter(f => f !== null && f !== undefined && f !== "")
        .map(f => new Date(f));

      if (fechasInicio.length > 0) {
        fechaInicio = new Date(Math.min(...fechasInicio.map(d => d.getTime())));
      }
    }

    if (!fechaInicio) return [];

    const fechas = [];
    let fechaActual = new Date(fechaInicio);
    const cuotas = parseInt(numeroCuotas) || 0;
    const presupuestoNum = parseFloat(presupuestoValue) || 0;
    const totalBase = obtenerTotalBase(presupuestoNum, cuotas, tipoPresupuesto);
    const porcentajes = normalizarPorcentajes(
      Array.from({ length: cuotas }, () => (cuotas ? 100 / cuotas : 0))
    );

    for (let i = 0; i < cuotas; i++) {
      // Incrementar según frecuencia (personalizado usa mensual como base)
      if (frecuenciaRecurrencia === "anual") {
        fechaActual.setFullYear(fechaActual.getFullYear() + 1);
      } else {
        // mensual y personalizado: incremento mensual
        fechaActual.setMonth(fechaActual.getMonth() + 1);
      }

      fechas.push({
        fecha: new Date(fechaActual).toISOString().split('T')[0],
        porcentaje: porcentajes[i] || 0,
        monto: totalBase ? (totalBase * (porcentajes[i] || 0)) / 100 : 0,
        moneda: monedaValue || "EUR"
      });
    }

    return fechas;
  }

  // Efecto para actualizar fechas cuando cambian parámetros y está en modo personalización
  useEffect(() => {
    if (!editingPresupuesto) return; // Solo cuando está editando presupuesto
    
    if (personalizandoFechas && (tipoPresupuesto === "recurrente" || tipoPresupuesto === "fraccionado") && numeroCuotas && presupuestoValue !== "") {
      const cuotasActuales = parseInt(numeroCuotas) || 0;
      const fechasActuales = fechasCobroPersonalizadas.length;
      const presupuestoNum = parseFloat(presupuestoValue) || 0;
      const totalBase = obtenerTotalBase(presupuestoNum, cuotasActuales, tipoPresupuesto);
      
      // Si cambió el número de cuotas, regenerar fechas
      if (cuotasActuales !== fechasActuales && cuotasActuales > 0) {
        const nuevasFechas = generarFechasAutomaticas();
        if (nuevasFechas.length > 0) {
          setFechasCobroPersonalizadas(nuevasFechas);
        }
      } else if (fechasActuales > 0 && fechasActuales === cuotasActuales) {
        // Actualizar montos/porcentajes si cambió el presupuesto o tipo (mantener fechas)
        const porcentajes = obtenerPorcentajesActuales(
          fechasCobroPersonalizadas,
          totalBase,
          cuotasActuales
        );
        
        const fechasActualizadas = fechasCobroPersonalizadas.map((cobro, index) => ({
          ...cobro,
          porcentaje: porcentajes[index],
          monto: totalBase ? (totalBase * porcentajes[index]) / 100 : 0,
          moneda: monedaValue || "EUR"
        }));
        setFechasCobroPersonalizadas(fechasActualizadas);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPresupuesto, numeroCuotas, presupuestoValue, frecuenciaRecurrencia, monedaValue, personalizandoFechas, editingPresupuesto]);

  // Efecto para desactivar personalización si cambia la frecuencia a algo que no sea "personalizado"
  useEffect(() => {
    if (editingPresupuesto && frecuenciaRecurrencia !== "personalizado" && personalizandoFechas) {
      setPersonalizandoFechas(false);
      setFechasCobroPersonalizadas([]);
    }
  }, [frecuenciaRecurrencia, editingPresupuesto, personalizandoFechas]);

  const porcentajesCobro = useMemo(() => {
    const cuotasActuales = parseInt(numeroCuotas) || fechasCobroPersonalizadas.length || 0;
    const presupuestoNum = parseFloat(presupuestoValue) || 0;
    const totalBase = obtenerTotalBase(presupuestoNum, cuotasActuales, tipoPresupuesto);

    return obtenerPorcentajesActuales(
      fechasCobroPersonalizadas,
      totalBase,
      cuotasActuales
    );
  }, [fechasCobroPersonalizadas, presupuestoValue, numeroCuotas, tipoPresupuesto]);

  // Actualizar una fecha específica
  function actualizarFechaCobro(index, nuevaFecha) {
    const nuevasFechas = [...fechasCobroPersonalizadas];
    if (nuevasFechas[index]) {
      nuevasFechas[index] = {
        ...nuevasFechas[index],
        fecha: nuevaFecha
      };
      setFechasCobroPersonalizadas(nuevasFechas);
    }
  }

  function actualizarPorcentajeCobro(index, nuevoPorcentaje) {
    const cuotasActuales = fechasCobroPersonalizadas.length;
    const presupuestoNum = parseFloat(presupuestoValue) || 0;
    const totalBase = obtenerTotalBase(presupuestoNum, cuotasActuales, tipoPresupuesto);
    const porcentajesActuales = obtenerPorcentajesActuales(
      fechasCobroPersonalizadas,
      totalBase,
      cuotasActuales
    );
    const fijados = fechasCobroPersonalizadas.map(cobro => cobro.fijado === true);
    const porcentajesActualizados = distribuirPorcentajes(
      porcentajesActuales,
      index,
      nuevoPorcentaje,
      fijados
    );

    const nuevasFechas = fechasCobroPersonalizadas.map((cobro, i) => ({
      ...cobro,
      porcentaje: porcentajesActualizados[i],
      monto: totalBase ? (totalBase * porcentajesActualizados[i]) / 100 : 0,
      moneda: monedaValue || "EUR"
    }));

    setFechasCobroPersonalizadas(nuevasFechas);
  }

  function toggleFijarCuota(index) {
    const nuevasFechas = [...fechasCobroPersonalizadas];
    if (nuevasFechas[index]) {
      nuevasFechas[index] = {
        ...nuevasFechas[index],
        fijado: !nuevasFechas[index].fijado
      };
      setFechasCobroPersonalizadas(nuevasFechas);
    }
  }

  function actualizarPorcentajeManual(index, nuevoPorcentajeTexto) {
    const nuevoPorcentaje = parseFloat(nuevoPorcentajeTexto) || 0;
    if (isNaN(nuevoPorcentaje) || nuevoPorcentaje < 0) return;
    
    actualizarPorcentajeCobro(index, Math.min(100, nuevoPorcentaje));
  }

  function actualizarMontoManual(index, nuevoMontoTexto) {
    const cuotasActuales = fechasCobroPersonalizadas.length;
    const presupuestoNum = parseFloat(presupuestoValue) || 0;
    const totalBase = obtenerTotalBase(presupuestoNum, cuotasActuales, tipoPresupuesto);
    
    if (totalBase === 0) return;
    
    const nuevoMonto = parseFloat(nuevoMontoTexto) || 0;
    if (isNaN(nuevoMonto) || nuevoMonto < 0) return;
    
    // Calcular el nuevo porcentaje basado en el monto
    const nuevoPorcentaje = (nuevoMonto / totalBase) * 100;
    
    // Si la cuota está fijada, solo actualizar monto y porcentaje de esta cuota
    const estaFijado = fechasCobroPersonalizadas[index]?.fijado === true;
    
    if (estaFijado) {
      const nuevasFechas = [...fechasCobroPersonalizadas];
      nuevasFechas[index] = {
        ...nuevasFechas[index],
        monto: nuevoMonto,
        porcentaje: nuevoPorcentaje,
        moneda: monedaValue || "EUR"
      };
      setFechasCobroPersonalizadas(nuevasFechas);
    } else {
      // Redistribuir porcentajes como si se hubiera ajustado el porcentaje
      actualizarPorcentajeCobro(index, Math.min(100, nuevoPorcentaje));
    }
  }

  // Restablecer fechas automáticas
  function restablecerFechasAutomaticas() {
    const fechasAuto = generarFechasAutomaticas();
    setFechasCobroPersonalizadas(fechasAuto);
    setPersonalizandoFechas(true);
  }

  // Función auxiliar para guardar tareas en el proyecto
  async function saveTareas(nuevasTareas) {
    await proyectosApi.update(id, { tareas: nuevasTareas });
    return { tareas: nuevasTareas };
  }

  async function createTarea(e) {
    e.preventDefault();
    if (!nuevaTarea.trim() || !proyecto) return;

    try {
      setCreatingTarea(true);

      const newTarea = {
        id: crypto.randomUUID(),
        nombre: nuevaTarea.trim(),
        completada: false,
        fecha_inicio: null,
        fecha_fin: null,
        created_at: new Date().toISOString()
      };

      const nuevasTareas = [newTarea, ...tareas];
      await saveTareas(nuevasTareas);

      setTareas(nuevasTareas);
      setProyecto({ ...proyecto, tareas: nuevasTareas });
      setNuevaTarea("");
    } catch (err) {
      console.error("Error al crear tarea:", err);
      alert(`Error al crear tarea: ${err.message}`);
    } finally {
      setCreatingTarea(false);
    }
  }

  async function toggleTarea(tareaId, completada) {
    if (!proyecto) return;

    try {
      setUpdatingTarea(tareaId);

      const nuevasTareas = tareas.map(t =>
        t.id === tareaId ? { ...t, completada: !completada } : t
      );

      await saveTareas(nuevasTareas);
      setTareas(nuevasTareas);
      setProyecto({ ...proyecto, tareas: nuevasTareas });
    } catch (err) {
      console.error("Error al actualizar tarea:", err);
      alert(`Error al actualizar tarea: ${err.message}`);
    } finally {
      setUpdatingTarea(null);
    }
  }

  async function deleteTarea(tareaId) {
    if (!proyecto) return;

    try {
      setDeletingTarea(tareaId);

      const nuevasTareas = tareas.filter(t => t.id !== tareaId);
      await saveTareas(nuevasTareas);

      setTareas(nuevasTareas);
      setProyecto({ ...proyecto, tareas: nuevasTareas });
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
      alert(`Error al eliminar tarea: ${err.message}`);
    } finally {
      setDeletingTarea(null);
    }
  }

  async function eliminarTodasLasTareas() {
    if (!proyecto || tareas.length === 0) return;

    if (!confirm(`¿Estás seguro de que quieres eliminar todas las tareas (${tareas.length})?`)) {
      return;
    }

    try {
      setEliminandoTodas(true);
      await saveTareas([]);

      setTareas([]);
      setProyecto({ ...proyecto, tareas: [] });
    } catch (err) {
      console.error("Error al eliminar todas las tareas:", err);
      alert(`Error al eliminar tareas: ${err.message}`);
    } finally {
      setEliminandoTodas(false);
    }
  }

  async function updateTareaFechas(tareaId, fechaInicio, fechaFin) {
    if (!proyecto) return;

    try {
      setUpdatingTarea(tareaId);

      const nuevasTareas = tareas.map(t =>
        t.id === tareaId
          ? { ...t, fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null }
          : t
      );

      await saveTareas(nuevasTareas);
      setTareas(nuevasTareas);
      setProyecto({ ...proyecto, tareas: nuevasTareas });
    } catch (err) {
      console.error("Error al actualizar fechas:", err);
      alert(`Error al actualizar fechas: ${err.message}`);
    } finally {
      setUpdatingTarea(null);
    }
  }

  async function consultarAI() {
    if (!proyecto) return;

    setShowAIResponse(true);
    setLoadingAI(true);
    setAiError(null);
    setAiResponse("");

    try {
      const tareasPendientes = tareas.filter(t => !t.completada).map(t => t.nombre);
      const tareasCompletadas = tareas.filter(t => t.completada).map(t => t.nombre);
      const nombresMiembros = miembros.map(m => m.nombre);

      const systemPrompt = `Eres un asistente experto en gestión de proyectos. 
Tienes acceso a la siguiente información del proyecto:

PROYECTO: ${proyecto.nombre}
${proyecto.descripcion ? `DESCRIPCIÓN:\n${proyecto.descripcion}` : "DESCRIPCIÓN: Sin descripción"}
CLIENTE: ${proyecto.clientes ? proyecto.clientes.nombre : "Sin cliente asignado"}
MIEMBROS: ${nombresMiembros.length > 0 ? nombresMiembros.join(", ") : "Sin miembros asignados"}
TAREAS:
  - Pendientes (${tareasPendientes.length}): ${tareasPendientes.length > 0 ? tareasPendientes.join(", ") : "Ninguna"}
  - Completadas (${tareasCompletadas.length}): ${tareasCompletadas.length > 0 ? tareasCompletadas.join(", ") : "Ninguna"}

Analiza este proyecto y proporciona insights útiles, sugerencias de mejora, o cualquier información relevante que pueda ayudar en la gestión del proyecto. Responde de manera concisa y práctica.`;

      const response = await queryDeepSeek(systemPrompt);
      setAiResponse(response);
    } catch (err) {
      console.error("Error al consultar AI:", err);
      setAiError(err.message);
    } finally {
      setLoadingAI(false);
    }
  }

  function cerrarAIDialog() {
    setShowAIResponse(false);
    setAiResponse("");
    setAiError(null);
  }

  async function generarTareasConIA() {
    if (!proyecto) return;

    try {
      setGenerandoTareas(true);

      const tareasExistentes = tareas.map(t => t.nombre);
      const nombresMiembros = miembros.map(m => m.nombre);
      const hoy = new Date().toISOString().split('T')[0];

      const systemPrompt = `Eres un asistente experto en gestión de proyectos. 
Analiza el siguiente proyecto y genera una lista de tareas necesarias para completarlo.

PROYECTO: ${proyecto.nombre}
${proyecto.descripcion ? `DESCRIPCIÓN:\n${proyecto.descripcion}` : "DESCRIPCIÓN: Sin descripción"}
CLIENTE: ${proyecto.clientes ? proyecto.clientes.nombre : "Sin cliente asignado"}
MIEMBROS: ${nombresMiembros.length > 0 ? nombresMiembros.join(", ") : "Sin miembros asignados"}
TAREAS EXISTENTES: ${tareasExistentes.length > 0 ? tareasExistentes.join(", ") : "Ninguna"}
FECHA ACTUAL: ${hoy}

IMPORTANTE: Responde ÚNICAMENTE con una lista de tareas en formato JSON array. Cada tarea debe tener:
- nombre: descripción corta de la tarea
- fecha_inicio: fecha de inicio en formato YYYY-MM-DD
- fecha_fin: fecha de fin en formato YYYY-MM-DD

Ejemplo de formato de respuesta:
[
  {"nombre": "Diseñar wireframes", "fecha_inicio": "2026-01-22", "fecha_fin": "2026-01-25"},
  {"nombre": "Desarrollar frontend", "fecha_inicio": "2026-01-26", "fecha_fin": "2026-02-05"}
]

Las fechas deben ser realistas, secuenciales y comenzar desde la fecha actual.
Genera tareas específicas, accionables y relevantes para completar este proyecto.
Responde SOLO con el JSON array, sin explicaciones adicionales.`;

      const response = await queryDeepSeek(
        systemPrompt,
        "Genera las tareas necesarias para completar este proyecto."
      );

      let tareasGeneradas = [];

      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          tareasGeneradas = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.warn("No se pudo parsear JSON, intentando formato de lista:", parseError);
      }

      if (tareasGeneradas.length === 0) {
        const lineas = response.split('\n').filter(linea => linea.trim());

        for (const linea of lineas) {
          const match = linea.match(/^[-*•]\s+(.+)$/) || linea.match(/^\d+[.)]\s+(.+)$/);
          if (match && match[1]) {
            const nombreTarea = match[1].trim();
            if (nombreTarea && nombreTarea.length > 0) {
              tareasGeneradas.push({ nombre: nombreTarea });
            }
          }
        }

        if (tareasGeneradas.length === 0) {
          for (const linea of lineas) {
            const limpia = linea.trim().replace(/^[-*•\d.)\s]+/, '').trim();
            if (limpia && limpia.length > 0 && limpia.length < 200) {
              tareasGeneradas.push({ nombre: limpia });
            }
          }
        }
      }

      if (tareasGeneradas.length === 0) {
        throw new Error("No se pudieron extraer tareas de la respuesta de la IA. Intenta de nuevo.");
      }

      const nuevasTareasGeneradas = tareasGeneradas.map(t => ({
        id: crypto.randomUUID(),
        nombre: (t.nombre || t).trim(),
        completada: false,
        fecha_inicio: t.fecha_inicio || null,
        fecha_fin: t.fecha_fin || null,
        created_at: new Date().toISOString()
      }));

      const todasLasTareas = [...tareas, ...nuevasTareasGeneradas];
      await saveTareas(todasLasTareas);

      setTareas(todasLasTareas);
      setProyecto({ ...proyecto, tareas: todasLasTareas });

      alert(`Se generaron ${tareasGeneradas.length} tareas exitosamente.`);
    } catch (err) {
      console.error("Error al generar tareas con IA:", err);
      alert(`Error al generar tareas: ${err.message}`);
    } finally {
      setGenerandoTareas(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando proyecto...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !proyecto) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="text-center max-w-md">
              <p className="font-medium">Error al cargar proyecto</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error || "Proyecto no encontrado"}
              </p>
              <Button onClick={() => navigate("/proyectos")} className="mt-4" variant="outline">
                Volver a Proyectos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/proyectos")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{proyecto.nombre}</h2>
            <p className="text-muted-foreground">Detalles del proyecto</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={consultarAI}
          disabled={loadingAI}
          size={isMobile ? "icon" : "default"}
          title="Consultar AI sobre este proyecto"
        >
          {loadingAI ? (
            <Loader2 className={cn("h-4 w-4 animate-spin", !isMobile && "mr-2")} />
          ) : (
            <Sparkles className={cn("h-4 w-4", !isMobile && "mr-2")} />
          )}
          {!isMobile && "Consultar AI"}
        </Button>
      </div>

      {/* Información del Proyecto */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Información del Proyecto</CardTitle>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                title="Editar descripción"
              >
                <Edit2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                {!isMobile && (proyecto.descripcion ? "Editar descripción" : "Agregar descripción")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            {isEditing ? (
              <div className="space-y-4">
                <textarea
                  value={editingDescripcion}
                  onChange={(e) => setEditingDescripcion(e.target.value)}
                  placeholder="Escribe una descripción en formato Markdown..."
                  rows={10}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y font-mono"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Puedes usar Markdown para formatear el texto
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={updateDescripcion}
                    disabled={saving}
                    size="sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={saving}
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : proyecto.descripcion ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {proyecto.descripcion}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="mb-3">Este proyecto no tiene descripción</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Agregar descripción
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Presupuesto */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Presupuesto
            </CardTitle>
            {!editingPresupuesto && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPresupuesto(true)}
                title="Editar presupuesto"
              >
                <Edit2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                {!isMobile && "Editar"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingPresupuesto ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="presupuesto" className="text-sm font-medium">
                    Presupuesto
                  </label>
                  <input
                    id="presupuesto"
                    type="number"
                    step="0.01"
                    min="0"
                    value={presupuestoValue}
                    onChange={(e) => setPresupuestoValue(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={savingPresupuesto}
                  />
                </div>
                <div>
                  <label htmlFor="moneda" className="text-sm font-medium">
                    Moneda
                  </label>
                  <select
                    id="moneda"
                    value={monedaValue}
                    onChange={(e) => setMonedaValue(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={savingPresupuesto}
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
                  value={tipoPresupuesto}
                  onChange={(e) => setTipoPresupuesto(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  disabled={savingPresupuesto}
                >
                  <option value="unico">Único (pago único)</option>
                  <option value="recurrente">Recurrente (pagos periódicos)</option>
                  <option value="fraccionado">Fraccionado (pago total en cuotas)</option>
                </select>
              </div>
              {(tipoPresupuesto === "recurrente" || tipoPresupuesto === "fraccionado") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="frecuencia" className="text-sm font-medium">
                      Frecuencia
                    </label>
                    <select
                      id="frecuencia"
                      value={frecuenciaRecurrencia}
                      onChange={(e) => setFrecuenciaRecurrencia(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={savingPresupuesto}
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
                      value={numeroCuotas}
                      onChange={(e) => setNumeroCuotas(e.target.value)}
                      placeholder="Ej: 12"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={savingPresupuesto}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {tipoPresupuesto === "recurrente"
                        ? "Ej: 12 cuotas = 12 períodos."
                        : "Ej: 12 cuotas = dividir el presupuesto total en 12 pagos iguales"}
                    </p>
                  </div>
                </div>
              )}
              {(tipoPresupuesto === "recurrente" || tipoPresupuesto === "fraccionado") && numeroCuotas && (
                <div className="space-y-3">
                  {frecuenciaRecurrencia === "personalizado" ? (
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Fechas de Pago</label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={restablecerFechasAutomaticas}
                          disabled={savingPresupuesto || !presupuestoValue || !numeroCuotas}
                          className="text-xs"
                        >
                          Calcular automáticamente
                        </Button>
                        <Button
                          type="button"
                          variant={personalizandoFechas ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (!personalizandoFechas) {
                              const fechasAuto = generarFechasAutomaticas();
                              setFechasCobroPersonalizadas(fechasAuto);
                            }
                            setPersonalizandoFechas(!personalizandoFechas);
                          }}
                          disabled={savingPresupuesto || !presupuestoValue || !numeroCuotas}
                          className="text-xs"
                        >
                          {personalizandoFechas ? "Usar automáticas" : "Personalizar fechas"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Fechas de Pago</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Las fechas se calcularán automáticamente según la frecuencia seleccionada.
                        </p>
                      </div>
                      <div>
                        <label htmlFor="fecha_inicio_primer_pago" className="text-sm font-medium">
                          Fecha de inicio del primer pago
                        </label>
                        <input
                          id="fecha_inicio_primer_pago"
                          type="date"
                          value={fechaInicioPrimerPago || ""}
                          onChange={(e) => setFechaInicioPrimerPago(e.target.value)}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          disabled={savingPresupuesto}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Fecha desde la cual se calcularán los pagos periódicos.
                        </p>
                      </div>
                    </div>
                  )}
                  {frecuenciaRecurrencia === "personalizado" && personalizandoFechas && fechasCobroPersonalizadas.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                      {fechasCobroPersonalizadas.map((cobro, index) => {
                        const estaFijado = cobro.fijado === true;
                        return (
                          <div key={index} className={cn(
                            "flex flex-col gap-2 rounded-md border p-3",
                            estaFijado ? "border-primary/50 bg-primary/5" : "border-input bg-muted/30"
                          )}>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <span className="text-sm font-medium w-20 shrink-0">
                                Cuota {index + 1}:
                              </span>
                              <input
                                type="date"
                                value={cobro.fecha || ""}
                                onChange={(e) => actualizarFechaCobro(index, e.target.value)}
                                className="text-base rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                                disabled={savingPresupuesto}
                              />
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={porcentajesCobro[index]?.toFixed(1) || "0.0"}
                                  onChange={(e) => actualizarPorcentajeManual(index, e.target.value)}
                                  onBlur={(e) => {
                                    const valor = parseFloat(e.target.value) || 0;
                                    actualizarPorcentajeCobro(index, Math.min(100, Math.max(0, valor)));
                                  }}
                                  disabled={savingPresupuesto || estaFijado}
                                  className="w-16 text-base rounded border border-input bg-background px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-ring"
                                  aria-label={`Porcentaje manual cuota ${index + 1}`}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={cobro.monto?.toFixed(2) || "0.00"}
                                  onChange={(e) => actualizarMontoManual(index, e.target.value)}
                                  onBlur={(e) => {
                                    const valor = parseFloat(e.target.value) || 0;
                                    actualizarMontoManual(index, valor.toFixed(2));
                                  }}
                                  disabled={savingPresupuesto}
                                  className="w-24 text-base rounded border border-input bg-background px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-ring"
                                  aria-label={`Monto manual cuota ${index + 1}`}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {cobro.moneda || monedaValue || 'EUR'}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant={estaFijado ? "default" : "outline"}
                                size="icon"
                                onClick={() => toggleFijarCuota(index)}
                                disabled={savingPresupuesto}
                                className="shrink-0 h-8 w-8 ml-auto"
                                title={estaFijado ? "Desfijar cuota" : "Fijar cuota"}
                              >
                                {estaFijado ? (
                                  <Lock className="h-3.5 w-3.5" />
                                ) : (
                                  <Unlock className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                            <PercentageSlider
                              className="w-full"
                              value={porcentajesCobro[index] || 0}
                              onChange={(e) => actualizarPorcentajeCobro(index, parseFloat(e.target.value))}
                              disabled={savingPresupuesto || estaFijado}
                              aria-label={`Porcentaje cuota ${index + 1}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={updatePresupuesto}
                  disabled={savingPresupuesto}
                  size="sm"
                >
                  {savingPresupuesto ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelEditPresupuesto}
                  disabled={savingPresupuesto}
                  size="sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : proyecto.presupuesto ? (
            <div className="space-y-2">
              <div>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('es-ES', {
                    style: 'currency',
                    currency: proyecto.moneda || 'EUR',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }).format(proyecto.presupuesto)}
                </p>
                {proyecto.tipo_presupuesto === "recurrente" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    por {getFrecuenciaLabel()}
                  </p>
                )}
                {proyecto.tipo_presupuesto === "fraccionado" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Total del presupuesto
                  </p>
                )}
              </div>
              {proyecto.tipo_presupuesto === "recurrente" && proyecto.numero_cuotas && (
                <div className="pt-2 border-t">
                  <p className="text-lg font-semibold">
                    Total: {new Intl.NumberFormat('es-ES', {
                      style: 'currency',
                      currency: proyecto.moneda || 'EUR',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(calcularPresupuestoTotal())}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {proyecto.numero_cuotas} {getFrecuenciaLabel()}{proyecto.numero_cuotas > 1 ? 's' : ''} × {new Intl.NumberFormat('es-ES', {
                      style: 'currency',
                      currency: proyecto.moneda || 'EUR',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(proyecto.presupuesto)}
                  </p>
                </div>
              )}
              {proyecto.tipo_presupuesto === "fraccionado" && proyecto.numero_cuotas && (
                <div className="pt-2 border-t">
                  <p className="text-lg font-semibold">
                    {proyecto.numero_cuotas} cuota{proyecto.numero_cuotas > 1 ? 's' : ''}: {new Intl.NumberFormat('es-ES', {
                      style: 'currency',
                      currency: proyecto.moneda || 'EUR',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(calcularMontoPorCuota())}
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Moneda: {proyecto.moneda || 'EUR'} • Tipo: {
                  proyecto.tipo_presupuesto === "recurrente" ? "Recurrente" :
                    proyecto.tipo_presupuesto === "fraccionado" ? "Fraccionado" :
                      "Único"
                }
              </p>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="mb-3">Este proyecto no tiene presupuesto asignado</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPresupuesto(true)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Agregar presupuesto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cliente y Miembros */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cliente Asociado */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cliente Asociado
              </CardTitle>
              {!showAddCliente && proyecto.clientes && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCliente(true)}
                  title="Cambiar cliente"
                >
                  <Edit2 className={cn("h-4 w-4", !isMobile && "mr-2")} />
                  {!isMobile && "Cambiar"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddCliente ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="cliente" className="text-sm font-medium">
                    Seleccionar Cliente
                  </label>
                  <select
                    id="cliente"
                    value={selectedClienteId}
                    onChange={(e) => setSelectedClienteId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={addingCliente}
                  >
                    <option value="">Selecciona un cliente</option>
                    {todosLosClientes
                      .filter((c) => !proyecto.clientes || c.id !== proyecto.clientes.id)
                      .map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={addCliente}
                    disabled={addingCliente || !selectedClienteId}
                    size="sm"
                  >
                    {addingCliente ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Agregando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Agregar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddCliente(false);
                      setSelectedClienteId("");
                    }}
                    disabled={addingCliente}
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : proyecto.clientes ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-md border border-input hover:bg-accent">
                  <div className="flex-1">
                    <p className="font-medium">{proyecto.clientes.nombre}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/clientes/${proyecto.clientes.id}`)}
                      title="Ver cliente"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeCliente}
                      disabled={removingCliente}
                      title="Remover cliente"
                      className="text-destructive hover:text-destructive"
                    >
                      {removingCliente ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="mb-3">Este proyecto no tiene cliente asignado</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCliente(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar cliente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Miembros asignados */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Miembros Asignados ({miembros.length})
              </CardTitle>
              {!showAddMember && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddMember(true)}
                  title="Agregar miembro"
                >
                  <UserPlus className={cn("h-4 w-4", !isMobile && "mr-2")} />
                  {!isMobile && "Agregar Miembro"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showAddMember ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="miembro" className="text-sm font-medium">
                    Seleccionar Miembro
                  </label>
                  <select
                    id="miembro"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={addingMember}
                  >
                    <option value="">Selecciona un miembro</option>
                    {todosLosMiembros
                      .filter((m) => !miembros.some((asignado) => asignado.id === m.id))
                      .map((miembro) => (
                        <option key={miembro.id} value={miembro.id}>
                          {miembro.nombre} {miembro.email && `(${miembro.email})`}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={addMiembro}
                    disabled={addingMember || !selectedMemberId}
                    size="sm"
                  >
                    {addingMember ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Agregando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Agregar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddMember(false);
                      setSelectedMemberId("");
                    }}
                    disabled={addingMember}
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : miembros.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="mb-3">Este proyecto no tiene miembros asignados</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddMember(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Agregar miembro
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {miembros.map((miembro) => (
                  <div
                    key={miembro.id}
                    className="flex items-center justify-between p-3 rounded-md border border-input hover:bg-accent"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{miembro.nombre}</p>
                      {miembro.email && (
                        <p className="text-sm text-muted-foreground">{miembro.email}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/miembros/${miembro.id}`)}
                        title="Ver miembro"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMiembro(miembro.id)}
                        disabled={removingMember === miembro.id}
                        title="Remover miembro"
                        className="text-destructive hover:text-destructive"
                      >
                        {removingMember === miembro.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tareas del proyecto */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Tareas ({tareas.filter(t => !t.completada).length}/{tareas.length})
              </CardTitle>
              <Button
                variant="outline"
                onClick={generarTareasConIA}
                disabled={generandoTareas || creatingTarea}
                size="sm"
              >
                {generandoTareas ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {!isMobile && "Generando..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {!isMobile && "Generar con IA"}
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-input">
                <Button
                  variant={vistaTimeline ? "ghost" : "secondary"}
                  size="sm"
                  onClick={() => setVistaTimeline(false)}
                  className="rounded-r-none border-0"
                  title="Vista de lista"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={vistaTimeline ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setVistaTimeline(true)}
                  className="rounded-l-none border-0"
                  title="Vista de timeline"
                >
                  <GanttChart className="h-4 w-4" />
                </Button>
              </div>
              {tareas.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={eliminarTodasLasTareas}
                  disabled={eliminandoTodas}
                  size="sm"
                >
                  {eliminandoTodas ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {!isMobile && "Eliminando..."}
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {!isMobile && "Eliminar todas"}
                      {isMobile && "Eliminar"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          <CardDescription>
            {tareas.filter(t => t.completada).length} de {tareas.length} tareas completadas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!vistaTimeline && (
            <form onSubmit={createTarea} className="flex gap-2">
              <input
                type="text"
                value={nuevaTarea}
                onChange={(e) => setNuevaTarea(e.target.value)}
                placeholder="Nueva tarea..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={creatingTarea || generandoTareas}
                required
              />
              <Button
                type="submit"
                disabled={creatingTarea || !nuevaTarea.trim() || generandoTareas}
                size="sm"
              >
                {creatingTarea ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </form>
          )}

          {vistaTimeline ? (
            <TareasTimeline
              tareas={tareas}
              onMoveTask={(id, fechaInicio, fechaFin) => updateTareaFechas(id, fechaInicio, fechaFin)}
              presupuesto={proyecto.presupuesto}
              moneda={proyecto.moneda}
              tipoPresupuesto={proyecto.tipo_presupuesto}
              frecuenciaRecurrencia={proyecto.frecuencia_recurrencia}
              numeroCuotas={proyecto.numero_cuotas}
              fechasCobroPersonalizadas={proyecto.fechas_cobro_personalizadas}
            />
          ) : (
            tareas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay tareas</p>
                <p className="text-sm mt-1">Agrega tu primera tarea arriba</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tareas.map((tarea) => (
                  <div
                    key={tarea.id}
                    className={cn(
                      "flex flex-col gap-2 p-3 rounded-md border border-input hover:bg-accent/50 transition-colors",
                      tarea.completada && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleTarea(tarea.id, tarea.completada)}
                        disabled={updatingTarea === tarea.id}
                        className="shrink-0"
                        title={tarea.completada ? "Marcar como pendiente" : "Marcar como completada"}
                      >
                        {updatingTarea === tarea.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : tarea.completada ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <span
                        className={cn(
                          "flex-1 text-sm",
                          tarea.completada && "line-through text-muted-foreground"
                        )}
                      >
                        {tarea.nombre}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTarea(tarea.id)}
                        disabled={deletingTarea === tarea.id || eliminandoTodas}
                        className="shrink-0 text-destructive hover:text-destructive"
                        title="Eliminar tarea"
                      >
                        {deletingTarea === tarea.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 ml-8 flex-wrap">
                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                      <input
                        type="date"
                        value={tarea.fecha_inicio || ""}
                        onChange={(e) => updateTareaFechas(tarea.id, e.target.value, tarea.fecha_fin)}
                        className="text-base rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                        disabled={updatingTarea === tarea.id}
                        title="Fecha de inicio"
                      />
                      <span className="text-xs text-muted-foreground">-</span>
                      <input
                        type="date"
                        value={tarea.fecha_fin || ""}
                        onChange={(e) => updateTareaFechas(tarea.id, tarea.fecha_inicio, e.target.value)}
                        className="text-base rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                        disabled={updatingTarea === tarea.id}
                        title="Fecha de fin"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Dialog de respuesta de AI */}
      <AIDialog
        open={showAIResponse}
        onClose={cerrarAIDialog}
        loading={loadingAI}
        error={aiError}
        response={aiResponse}
        onRetry={consultarAI}
      />
    </div>
  );
}
