import * as React from "react"
import { cn } from "@/lib/utils"

const PercentageSlider = React.forwardRef(
  (
    {
      value = 0,
      onChange,
      min = 0,
      max = 100,
      step = 0.1,
      disabled = false,
      showValue = true,
      className,
      ...props
    },
    ref
  ) => (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          "h-2 w-full cursor-pointer accent-primary",
          disabled && "cursor-not-allowed opacity-60"
        )}
        {...props}
      />
      {showValue && (
        <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
          {Number.isFinite(value) ? `${value.toFixed(1)}%` : "0%"}
        </span>
      )}
    </div>
  )
)

PercentageSlider.displayName = "PercentageSlider"

export { PercentageSlider }
