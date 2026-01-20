import { useState, useEffect } from "react"

/**
 * Hook para detectar si la vista es vertical (portrait) y si es mobile
 * @param {number} mobileBreakpoint - Ancho en píxeles para considerar mobile (default: 768)
 * @returns {Object} { isVertical: boolean, isMobile: boolean, width: number, height: number }
 */
export function useVerticalViewport(mobileBreakpoint = 768) {
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") {
      return {
        isVertical: true,
        isMobile: true,
        width: 0,
        height: 0,
      }
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const isVertical = height > width
    const isMobile = width < mobileBreakpoint

    return {
      isVertical,
      isMobile,
      width,
      height,
    }
  })

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    function handleResize() {
      const width = window.innerWidth
      const height = window.innerHeight
      const isVertical = height > width
      const isMobile = width < mobileBreakpoint

      setViewport({
        isVertical,
        isMobile,
        width,
        height,
      })
    }

    // Escuchar cambios de tamaño de ventana
    window.addEventListener("resize", handleResize)
    
    // Escuchar cambios de orientación (útil para dispositivos móviles)
    window.addEventListener("orientationchange", handleResize)

    // Limpiar listeners al desmontar
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("orientationchange", handleResize)
    }
  }, [mobileBreakpoint])

  return viewport
}
