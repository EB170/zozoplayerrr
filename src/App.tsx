import { Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MonetagManager from "./components/MonetagManager";
import React from "react";
import { adStateManager } from "@/lib/adStateManager"; // Import du manager

const queryClient = new QueryClient();

const App = () => {
  const monetagManagerRef = React.useRef(null);

  // Initialisation du Ad State Manager une seule fois
  React.useEffect(() => {
    console.log(`[AdManager] User Status: ${adStateManager.getUserStatus()}`);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MonetagManager ref={monetagManagerRef} />
        <Sonner
          toastOptions={{
            classNames: {
              toast:
                'group toast group-[.toaster]:bg-card/80 group-[.toaster]:backdrop-blur-lg group-[.toaster]:text-foreground group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg',
              description: 'group-[.toast]:text-muted-foreground',
              actionButton:
                'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
              cancelButton:
                'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
              success: 'group-[.toast]:!border-green-500/50',
              error: 'group-[.toast]:!border-red-500/50',
              info: 'group-[.toast]:!border-primary/50',
            },
          }}
        />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;