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
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useVerticalViewport } from "@/hooks/use-vertical-viewport"

export function AppSidebar() {
  const location = useLocation()
  const { isMobile } = useVerticalViewport()

  const items = [
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
    {
      title: "Notas",
      url: "/notas",
      icon: StickyNote,
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
                    <SidebarMenuButton
                      asChild
                      variant={isActive ? "active" : "default"}
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
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
