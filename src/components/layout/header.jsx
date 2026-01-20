import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabase";

const getPageTitle = (pathname) => {
  if (pathname.startsWith("/proyectos")) {
    return "Proyectos";
  }
  if (pathname.startsWith("/clientes")) {
    return "Clientes";
  }
  if (pathname.startsWith("/miembros")) {
    return "Miembros";
  }
  return "TheLab";
};

export function Header() {
  const location = useLocation();
  const [pageTitle, setPageTitle] = useState(getPageTitle(location.pathname));

  useEffect(() => {
    const loadDetailTitle = async () => {
      // Detectar si estamos en una ruta de detalle con ID
      const clienteMatch = location.pathname.match(/^\/clientes\/([^/]+)$/);
      const proyectoMatch = location.pathname.match(/^\/proyectos\/([^/]+)$/);
      const miembroMatch = location.pathname.match(/^\/miembros\/([^/]+)$/);

      if (clienteMatch) {
        const id = clienteMatch[1];
        try {
          const { data, error } = await supabase
            .from("clientes")
            .select("nombre")
            .eq("id", id)
            .single();

          if (!error && data) {
            setPageTitle(data.nombre);
          } else {
            setPageTitle("Clientes");
          }
        } catch (err) {
          setPageTitle("Clientes");
        }
      } else if (proyectoMatch) {
        const id = proyectoMatch[1];
        try {
          const { data, error } = await supabase
            .from("proyectos")
            .select("nombre")
            .eq("id", id)
            .single();

          if (!error && data) {
            setPageTitle(data.nombre);
          } else {
            setPageTitle("Proyectos");
          }
        } catch (err) {
          setPageTitle("Proyectos");
        }
      } else if (miembroMatch) {
        const id = miembroMatch[1];
        try {
          const { data, error } = await supabase
            .from("miembros")
            .select("nombre")
            .eq("id", id)
            .single();

          if (!error && data) {
            setPageTitle(data.nombre);
          } else {
            setPageTitle("Miembros");
          }
        } catch (err) {
          setPageTitle("Miembros");
        }
      } else {
        // Ruta normal, usar el título genérico
        setPageTitle(getPageTitle(location.pathname));
      }
    };

    loadDetailTitle();
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-10 w-full border-b h-16 bg-background backdrop-blur-sm">
      <div className="container flex items-center justify-between mx-auto px-4 h-full">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold">{pageTitle}</h1>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
