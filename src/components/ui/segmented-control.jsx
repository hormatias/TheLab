import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Control segmentado tipo pill: opciones como botones en fila.
 * @param {Array<{value: string, label: string}>} options
 * @param {string} value
 * @param {(value: string) => void} onChange
 */
const SegmentedControl = React.forwardRef(
  (
    {
      options = [],
      value,
      onChange,
      disabled = false,
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role="group"
      aria-label={props["aria-label"]}
    className={cn(
      "inline-flex flex-wrap gap-0.5 rounded-lg border border-input bg-muted/50 p-0.5",
      disabled && "opacity-60 pointer-events-none",
      className
    )}
      {...props}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange?.(opt.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
)

SegmentedControl.displayName = "SegmentedControl"

export { SegmentedControl }
