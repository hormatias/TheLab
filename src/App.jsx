import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Dashboard } from "@/components/layout/dashboard";
import { ProyectosList } from "@/components/proyectos/proyectos-list";
import { ClientesList } from "@/components/clientes/clientes-list";
import { MiembrosList } from "@/components/miembros/miembros-list";
import { FormulariosList } from "@/components/formularios/formularios-list";
import { Contabilidad } from "@/components/contabilidad/contabilidad";
import { Camaras } from "@/components/camaras/camaras";
import { ProyectoDetail } from "@/components/proyectos/proyecto-detail";
import { ClienteDetail } from "@/components/clientes/cliente-detail";
import { MiembroDetail } from "@/components/miembros/miembro-detail";
import { FormularioDetail } from "@/components/formularios/formulario-detail";
import { MensajesList } from "@/components/mensajes/mensajes-list";
import { Conversacion } from "@/components/mensajes/conversacion";
import { NuevoMensaje } from "@/components/mensajes/nuevo-mensaje";
import { VistaGeneral } from "@/components/vista-general/vista-general";

function App() {
  return (
    <BrowserRouter>
      <Dashboard>
        <Routes>
          <Route path="/" element={<Navigate to="/proyectos" replace />} />
          <Route path="/vista-general" element={<Navigate to="/proyectos" replace />} />
          <Route path="/proyectos/lista" element={<ProyectosList />} />
          <Route path="/proyectos/:id" element={<ProyectoDetail />} />
          <Route path="/proyectos" element={<VistaGeneral />} />
          <Route path="/clientes" element={<ClientesList />} />
          <Route path="/clientes/:id" element={<ClienteDetail />} />
          <Route path="/miembros" element={<MiembrosList />} />
          <Route path="/miembros/:id" element={<MiembroDetail />} />
          <Route path="/formularios" element={<FormulariosList />} />
          <Route path="/formularios/:id" element={<FormularioDetail />} />
          <Route path="/contabilidad" element={<Contabilidad />} />
          <Route path="/camaras" element={<Camaras />} />
          <Route path="/mensajes" element={<MensajesList />} />
          <Route path="/mensajes/nuevo" element={<NuevoMensaje />} />
          <Route path="/mensajes/:miembroId" element={<Conversacion />} />
        </Routes>
      </Dashboard>
    </BrowserRouter>
  );
}

export default App;
