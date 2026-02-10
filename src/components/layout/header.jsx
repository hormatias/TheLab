import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getEntityById } from "@/hooks/use-entities";

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
  if (pathname.startsWith("/formularios")) {
    return "Formularios";
  }
  if (pathname.startsWith("/contabilidad")) {
    return "Contabilidad";
  }
  if (pathname.startsWith("/camaras")) {
    return "Cámaras de Andorra";
  }
  if (pathname.startsWith("/notas")) {
    return "Notas";
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
      const formularioMatch = location.pathname.match(/^\/formularios\/([^/]+)$/);
      const notaMatch = location.pathname.match(/^\/notas\/([^/]+)$/);

      if (clienteMatch) {
        const id = clienteMatch[1];
        try {
          const { data } = await getEntityById("cliente", id);
          if (data) {
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
          const { data } = await getEntityById("proyecto", id);
          if (data) {
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
          const { data } = await getEntityById("miembro", id);
          if (data) {
            setPageTitle(data.nombre);
          } else {
            setPageTitle("Miembros");
          }
        } catch (err) {
          setPageTitle("Miembros");
        }
      } else if (formularioMatch) {
        const id = formularioMatch[1];
        try {
          const { data } = await getEntityById("formulario", id);
          if (data) {
            setPageTitle(data.nombre);
          } else {
            setPageTitle("Formularios");
          }
        } catch (err) {
          setPageTitle("Formularios");
        }
      } else if (notaMatch) {
        const id = notaMatch[1];
        try {
          const { data } = await getEntityById("nota", id);
          if (data) {
            setPageTitle(data.titulo || "Notas");
          } else {
            setPageTitle("Notas");
          }
        } catch (err) {
          setPageTitle("Notas");
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
