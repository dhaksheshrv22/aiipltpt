import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VehicleEntry from "./pages/VehicleEntry";
import ActiveVehicles from "./pages/ActiveVehicles";
import VehicleHistory from "./pages/VehicleHistory";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import MonthlyPasses from "./pages/MonthlyPasses";
import VehicleStock from "./pages/VehicleStock";
import Help from "./pages/Help";
import RecycleBin from "./pages/RecycleBin";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/entry" element={<VehicleEntry />} />
            <Route path="/active-vehicles" element={<ActiveVehicles />} />
            <Route path="/stock" element={<VehicleStock />} />
            <Route path="/monthly-passes" element={<MonthlyPasses />} />
            <Route path="/history" element={<VehicleHistory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/help" element={<Help />} />
            <Route path="/recycle-bin" element={<RecycleBin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
