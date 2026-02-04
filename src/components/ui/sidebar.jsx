import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Sidebar Context
const SidebarContext = React.createContext({
  open: false,
  setOpen: () => {},
  isMobile: false,
})

const useSidebar = () => {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

// Sidebar Provider
const SidebarProvider = ({ children, defaultOpen = true, ...props }) => {
  // Inicializar el estado basado en si es mobile o no
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.innerWidth < 768
  })
  
  // Solo abrir por defecto si NO es mobile
  const [open, setOpen] = React.useState(() => {
    if (typeof window === "undefined") return defaultOpen
    return defaultOpen && window.innerWidth >= 768
  })

  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Si cambia a mobile, cerrar el sidebar automáticamente
      if (mobile) {
        setOpen(false)
      }
      // En desktop, no forzar la apertura - respetar la decisión del usuario
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return (
    <SidebarContext.Provider value={{ open, setOpen, isMobile }}>
      <div className="group/sidebar-wrapper flex w-full" {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

// Sidebar Trigger
const SidebarTrigger = React.forwardRef(({ className, ...props }, ref) => {
  const { setOpen } = useSidebar()
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={() => setOpen((prev) => !prev)}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

// Sidebar
const sidebarVariants = cva(
  "group/sidebar peer/sidebar fixed inset-y-0 z-50 w-64 shrink-0 border-r bg-background transition-all duration-300 ease-in-out flex flex-col",
  {
    variants: {
      state: {
        open: "translate-x-0",
        closed: "-translate-x-full",
      },
    },
    defaultVariants: {
      state: "closed",
    },
  }
)

const Sidebar = React.forwardRef(({ className, ...props }, ref) => {
  const { open, setOpen, isMobile } = useSidebar()
  const state = open ? "open" : "closed"

  if (isMobile) {
    return (
      <>
        {open && (
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          ref={ref}
          className={cn(sidebarVariants({ state }), "z-50", className)}
          {...props}
        />
      </>
    )
  }

  return (
    <aside
      ref={ref}
      className={cn(sidebarVariants({ state }), className)}
      {...props}
    />
  )
})
Sidebar.displayName = "Sidebar"

// Sidebar Header
const SidebarHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-16 shrink-0 items-center gap-2 border-b px-4", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

// Sidebar Content
const SidebarContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-4", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

// Sidebar Footer
const SidebarFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex shrink-0 items-center gap-2 border-t px-4 py-4", className)}
    {...props}
  />
))
SidebarFooter.displayName = "SidebarFooter"

// Sidebar Group
const SidebarGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-2", className)}
    {...props}
  />
))
SidebarGroup.displayName = "SidebarGroup"

// Sidebar Group Label
const SidebarGroupLabel = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 text-xs font-semibold text-muted-foreground", className)}
    {...props}
  />
))
SidebarGroupLabel.displayName = "SidebarGroupLabel"

// Sidebar Group Content
const SidebarGroupContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

// Sidebar Menu
const SidebarMenu = React.forwardRef(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

// Sidebar Menu Item
const SidebarMenuItem = React.forwardRef(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

// Sidebar Menu Button
const sidebarMenuButtonVariants = cva(
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        active: "bg-accent text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(sidebarMenuButtonVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

// Sidebar Inset
const SidebarInset = React.forwardRef(({ className, ...props }, ref) => {
  const { open, isMobile } = useSidebar()
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-screen flex-1 flex-col min-w-0 transition-all duration-300 ease-in-out",
        // Solo agregar margen en desktop cuando el sidebar está abierto
        !isMobile && open && "md:ml-64",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}
