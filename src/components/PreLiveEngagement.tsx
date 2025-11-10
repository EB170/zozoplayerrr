"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Tv, BellRing, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
// import { cn } from '@/lib/utils'; // Removed as 'cn' is not used
// import { useIsMobile } from '@/hooks/use-mobile'; // Removed as 'isMobile' is not used

interface PreLiveEngagementProps {
  streamStartsInSeconds: number; // Temps restant avant le live
  onLiveStart: () => void; // Callback quand le live commence
  onPlayClick: () => void; // Callback quand l'utilisateur clique sur "Play"
  monetagRef: React.RefObject<{
    showPopUnder: () => void;
    showInPagePush: () => void;
    requestPushNotifications: () => void;
  }>;
}

const PUSH_OPT_IN_DISMISSED_KEY = 'monetag_push_opt_in_dismissed';
const IN_PAGE_PUSH_LAST_SHOWN_KEY = 'monetag_in_page_push_last_shown';
const IN_PAGE_PUSH_COOLDOWN_HOURS = 2; // Cooldown pour l'In-Page Push

const PreLiveEngagement = ({ streamStartsInSeconds, onLiveStart, onPlayClick, monetagRef }: PreLiveEngagementProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState(streamStartsInSeconds);
  const [hasClickedPlay, setHasClickedPlay] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showInPagePush, setShowInPagePush] = useState(false);
  // const isMobile = useIsMobile(); // Removed as 'isMobile' is not used

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayButtonClick = useCallback(() => {
    if (!hasClickedPlay) {
      setHasClickedPlay(true);
      onPlayClick(); // Déclenche le Pop-under via Index.tsx
      toast.info("Le live commencera bientôt !");
    }
  }, [hasClickedPlay, onPlayClick]);

  const handlePushOptIn = useCallback(() => {
    monetagRef.current?.requestPushNotifications();
    localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY, Date.now().toString()); // Marque comme "tenté"
    setShowPushPrompt(false);
    toast.success("Demande de notifications envoyée !");
  }, [monetagRef]);

  const dismissPushPrompt = useCallback(() => {
    localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY, Date.now().toString());
    setShowPushPrompt(false);
    toast.info("Notifications désactivées pour l'instant.");
  }, []);

  useEffect(() => {
    setRemainingSeconds(streamStartsInSeconds);
    if (streamStartsInSeconds <= 0) {
      onLiveStart();
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onLiveStart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [streamStartsInSeconds, onLiveStart]);

  // Monetag Timeline Logic
  useEffect(() => {
    // T-5 minutes: In-Page Push
    if (remainingSeconds === 5 * 60 && !showInPagePush) {
      const lastShown = localStorage.getItem(IN_PAGE_PUSH_LAST_SHOWN_KEY);
      const now = Date.now();
      if (!lastShown || (now - parseInt(lastShown)) > IN_PAGE_PUSH_COOLDOWN_HOURS * 60 * 60 * 1000) {
        // Check if push notifications are already accepted
        if (!('Notification' in window) || Notification.permission !== 'granted') {
          setShowInPagePush(true);
          monetagRef.current?.showInPagePush(); // Trigger In-Page Push
          localStorage.setItem(IN_PAGE_PUSH_LAST_SHOWN_KEY, now.toString());
          toast.info("Découvrez plus de contenu !");
        }
      }
    }

    // T-2 minutes: Native Push Opt-in
    if (remainingSeconds === 2 * 60 && !showPushPrompt) {
      const lastDismissed = localStorage.getItem(PUSH_OPT_IN_DISMISSED_KEY);
      const now = Date.now();
      // Only show if not already granted and not dismissed recently (e.g., within 24h)
      if (
        ('Notification' in window && Notification.permission !== 'granted') &&
        (!lastDismissed || (now - parseInt(lastDismissed)) > 24 * 60 * 60 * 1000) // Cooldown 24h
      ) {
        setShowPushPrompt(true);
      }
    }
  }, [remainingSeconds, monetagRef, showInPagePush, showPushPrompt]);

  if (remainingSeconds <= 0) {
    return null; // Le live a commencé, ce composant n'est plus nécessaire
  }

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white p-4">
      <div className="text-center space-y-6">
        <Tv className="w-16 h-16 text-primary mx-auto animate-pulse" />
        <h2 className="text-3xl md:text-4xl font-bold">Le live commence dans...</h2>
        <p className="text-6xl md:text-8xl font-extrabold text-primary animate-in fade-in zoom-in-95 duration-500">
          {formatTime(remainingSeconds)}
        </p>
        <p className="text-lg md:text-xl text-muted-foreground">Préparez-vous pour l'action !</p>
        <Button
          onClick={handlePlayButtonClick}
          className="mt-8 px-8 py-4 text-lg md:text-xl bg-primary hover:bg-primary/90 shadow-glow transition-all duration-300"
          disabled={hasClickedPlay}
        >
          {hasClickedPlay ? (
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
          ) : (
            <Sparkles className="w-6 h-6 mr-2" />
          )}
          {hasClickedPlay ? "En attente..." : "Lancer l'attente"}
        </Button>
      </div>

      {/* Prompt pour les notifications Push (T-2 min) */}
      {showPushPrompt && (
        <Card className="fixed bottom-4 right-4 bg-card border border-primary/50 shadow-lg p-4 max-w-xs text-center space-y-3 animate-in slide-in-from-bottom-4 duration-300 z-[60]">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            onClick={dismissPushPrompt}
          >
            <X className="w-4 h-4" />
          </Button>
          <BellRing className="w-8 h-8 text-primary mx-auto animate-bounce-slow" />
          <p className="font-semibold text-foreground text-base">
            Ne manquez pas le coup d'envoi !
          </p>
          <p className="text-sm text-muted-foreground">
            Recevez une notification dès que le live commence.
          </p>
          <Button onClick={handlePushOptIn} className="w-full bg-primary hover:bg-primary/90 text-sm">
            Oui, je veux être notifié !
          </Button>
        </Card>
      )}
    </div>
  );
};

export default PreLiveEngagement;