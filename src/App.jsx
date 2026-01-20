import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Dashboard } from "@/components/layout/dashboard";
import { ProyectosList } from "@/components/proyectos/proyectos-list";
import { ClientesList } from "@/components/clientes/clientes-list";
import { MiembrosList } from "@/components/miembros/miembros-list";
import { ProyectoDetail } from "@/components/proyectos/proyecto-detail";
import { ClienteDetail } from "@/components/clientes/cliente-detail";
import { MiembroDetail } from "@/components/miembros/miembro-detail";

function App() {
  return (
    <BrowserRouter>
      <Dashboard>
        <Routes>
          <Route path="/" element={<Navigate to="/proyectos" replace />} />
          <Route path="/proyectos" element={<ProyectosList />} />
          <Route path="/proyectos/:id" element={<ProyectoDetail />} />
          <Route path="/clientes" element={<ClientesList />} />
          <Route path="/clientes/:id" element={<ClienteDetail />} />
          <Route path="/miembros" element={<MiembrosList />} />
          <Route path="/miembros/:id" element={<MiembroDetail />} />
        </Routes>
      </Dashboard>
    </BrowserRouter>
  );
}

export default App;
