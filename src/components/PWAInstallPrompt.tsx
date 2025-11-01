"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Share2, PlusCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

const PWAInstallPrompt = () => {
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useIsMobile();

  const handleDismiss = useCallback(() => {
    localStorage.setItem('pwa_install_prompt_dismissed', 'true');
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsVisible(false);
      return;
    }

    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    const hasDismissedPrompt = localStorage.getItem('pwa_install_prompt_dismissed');

    if (isMobile && !isPWA && !hasDismissedPrompt) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2000); // Show after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [isMobile]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="relative bg-card border border-primary/50 shadow-2xl p-8 md:p-10 rounded-lg mx-4 max-w-sm sm:max-w-md md:max-w-lg text-center space-y-8 animate-in zoom-in-95 slide-in-from-bottom-2 duration-500">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="absolute top-4 right-4 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="space-y-5 md:space-y-6">
          <p className="font-bold text-foreground text-xl md:text-2xl flex items-center justify-center gap-2 md:gap-3">
            <Sparkles className="w-7 h-7 text-primary flex-shrink-0 animate-pulse" />
            Passez à l'expérience complète !
          </p>
          <p className="text-base md:text-lg text-muted-foreground">
            Installez l'application pour une meilleure fluidité et un accès rapide.
          </p>
          <ol className="list-none space-y-4 md:space-y-5 text-foreground/80 text-left">
            <li className="flex items-start gap-3 md:gap-4">
              <span className="flex items-center justify-center w-8 h-8 bg-primary/20 text-primary rounded-full font-bold text-base flex-shrink-0 mt-0.5">1</span>
              Appuyez sur l'icône <Share2 className="inline-block w-6 h-6 text-primary mx-1 flex-shrink-0 animate-bounce-slow" /> <span className="font-bold text-primary">Partager</span> (ou menu).
            </li>
            <li className="flex items-start gap-3 md:gap-4">
              <span className="flex items-center justify-center w-8 h-8 bg-primary/20 text-primary rounded-full font-bold text-base flex-shrink-0 mt-0.5">2</span>
              <span className="font-bold text-accent">Ajoutez à l'écran d'accueil</span> <PlusCircle className="inline-block w-6 h-6 text-accent mx-1 flex-shrink-0 animate-bounce-slow delay-100" />.
            </li>
            <li className="flex items-start gap-3 md:gap-4">
              <span className="flex items-center justify-center w-8 h-8 bg-primary/20 text-primary rounded-full font-bold text-base flex-shrink-0 mt-0.5">3</span>
              Confirmez et profitez en plein écran !
            </li>
          </ol>
          <p className="text-sm md:text-base text-muted-foreground/60 mt-5 md:mt-6">
            (Cela ne prend que quelques secondes et transforme le site en une véritable app.)
          </p>
        </div>
        <Button onClick={handleDismiss} className="w-full bg-primary hover:bg-primary/90 mt-8 text-base md:text-lg py-3 md:py-4">
          Compris !
        </Button>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;