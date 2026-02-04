import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Símbolo corto de moneda para KPIs */
const MONEDA_SIMBOLO = { EUR: "€", USD: "$", GBP: "£", ARS: "$", MXN: "$", CLP: "$", COP: "$", BRL: "R$" }

/**
 * Formatea el presupuesto de un proyecto para mostrar como KPI.
 * - Único: "25K" + "€"
 * - Recurrente: "6.7K" + "€/mes · 12 meses"
 * - Fraccionado: "25K" + "€ en 3 cuotas"
 */
export function formatPresupuestoKpi(proyecto) {
  const n = proyecto?.presupuesto != null && proyecto.presupuesto !== "" ? Number(proyecto.presupuesto) : NaN
  if (Number.isNaN(n) || n < 0) return null

  const moneda = proyecto?.moneda || "EUR"
  const simbolo = MONEDA_SIMBOLO[moneda] ?? moneda
  const tipo = proyecto?.tipo_presupuesto || "unico"
  const cuotas = proyecto?.numero_cuotas

  function abbreviate(num) {
    const abs = Math.abs(num)
    if (abs >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    if (abs >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
    return num.toLocaleString("es-ES", { maximumFractionDigits: 0 })
  }

  // Recurrente: n = monto por mes → "6.7K" + "€/mes · 12 meses"
  if (tipo === "recurrente" && cuotas) {
    return { main: abbreviate(n), sub: `${simbolo}/mes · ${cuotas} meses` }
  }
  // Fraccionado: n = total → "25K" + "€ en 3 cuotas"
  if (tipo === "fraccionado" && cuotas) {
    return { main: abbreviate(n), sub: `${simbolo} en ${cuotas} cuotas` }
  }
  return { main: abbreviate(n), sub: simbolo }
}
