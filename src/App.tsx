import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import UserPreferenceSync from "@/components/preferences/UserPreferenceSync";
import ProtectedRoute from "@/components/ProtectedRoute";
import AgencyRoute from "@/components/AgencyRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TeamManagement from "./pages/TeamManagement";
import Deposit from "./pages/Deposit";
import Book from "./pages/Book";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Reserve from "./pages/Reserve";
import ReserveBook from "./pages/ReserveBook";
import ReserveInquire from "./pages/ReserveInquire";
import AgencyOS from "./pages/AgencyOS";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LanguageProvider>
          <AuthProvider>
            <UserPreferenceSync />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reserve" element={<Reserve />} />
                <Route path="/reserve/book" element={<ReserveBook />} />
                <Route path="/reserve/inquire" element={<ReserveInquire />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <ProtectedRoute>
                      <TeamManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/book"
                  element={
                    <ProtectedRoute>
                      <Book />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <Calendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/deposit"
                  element={
                    <ProtectedRoute>
                      <Deposit />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agency"
                  element={
                    <AgencyRoute>
                      <AgencyOS />
                    </AgencyRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
