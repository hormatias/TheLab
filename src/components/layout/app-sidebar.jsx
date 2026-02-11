import { Link, useLocation } from "react-router-dom"
import { FolderOpen, FileText, DollarSign, Camera, StickyNote } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useVerticalViewport } from "@/hooks/use-vertical-viewport"

export function AppSidebar() {
  const location = useLocation()
  const { isMobile } = useVerticalViewport()

  const items = [
    {
      title: "Instrucciones",
      url: "/instrucciones",
      icon: StickyNote,
    },
    {
      title: "Proyectos",
      url: "/proyectos",
      icon: FolderOpen,
    },
    {
      title: "Contabilidad",
      url: "/contabilidad",
      icon: DollarSign,
    },
    {
      title: "Formularios",
      url: "/formularios",
      icon: FileText,
    },
    {
      title: "Cámaras de Andorra",
      url: "/camaras",
      icon: Camera,
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          <span className={cn("font-bold text-lg", isMobile && "hidden")}>
            TheLab
          </span>
          {isMobile && (
            <span className="font-bold text-lg">TL</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!isMobile && <SidebarGroupLabel>Navegación</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location.pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <Link
                      to={item.url}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
                        isActive && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
