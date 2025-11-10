"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Tv, Sparkles } from 'lucide-react'; // Removed BellRing, X
import { toast } from 'sonner';
// import { Card } from '@/components/ui/card'; // Removed Card
import PushNotificationSoftPrompt from './PushNotificationSoftPrompt'; // Import du soft prompt
// import { cn } from '@/lib/utils'; // Removed cn

interface PreLiveEngagementProps {
  streamStartsInSeconds: number; // Temps restant avant le live
  onLiveStart: () => void; // Callback quand le live commence
  onPlayClick: () => void; // Callback quand l'utilisateur clique sur "Play" (pour Pop-under)
  monetagRef: React.RefObject<{
    showPopUnder: () => void;
    showInPagePush: () => void;
    requestPushNotifications: () => void;
    sendLiveStartPushNotification: () => void;
  }>;
}

const PUSH_OPT_IN_DISMISSED_KEY = 'monetag_push_opt_in_dismissed';
// const PUSH_OPT_IN_ACCEPTED_KEY = 'monetag_push_opt_in_accepted'; // Removed as its value is never read
const IN_PAGE_PUSH_LAST_SHOWN_KEY = 'monetag_in_page_push_last_shown';
const IN_PAGE_PUSH_COOLDOWN_HOURS = 2; // Cooldown pour l'In-Page Push
const PUSH_PROMPT_COOLDOWN_HOURS = 24; // Cooldown pour le soft prompt Push

const PreLiveEngagement = ({ streamStartsInSeconds, onLiveStart, onPlayClick, monetagRef }: PreLiveEngagementProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState(streamStartsInSeconds);
  const [hasClickedPlay, setHasClickedPlay] = useState(false);
  const [showSoftPushPrompt, setShowSoftPushPrompt] = useState(false);
  const [inPagePushTriggered, setInPagePushTriggered] = useState(false); // Pour IntersectionObserver
  const [exitIntentTriggered, setExitIntentTriggered] = useState(false); // Pour intention de sortie

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inPagePushRef = useRef<HTMLDivElement>(null); // Ref pour l'IntersectionObserver

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayButtonClick = useCallback(() => {
    if (!hasClickedPlay) {
      setHasClickedPlay(true);
      // Déclenchement du Pop-under sur un clic secondaire ou après un délai
      // Pour l'instant, nous le déclenchons ici comme demandé, mais avec un avertissement.
      // Une meilleure approche serait un second clic ou un clic sur un élément non-critique.
      monetagRef.current?.showPopUnder(); // Déclenche le Pop-under
      toast.info("Le live commencera bientôt !");
    }
  }, [hasClickedPlay, monetagRef]);

  const handleSoftPushAccept = useCallback(() => {
    setShowSoftPushPrompt(false);
    monetagRef.current?.requestPushNotifications(); // Déclenche la demande native
  }, [monetagRef]);

  const handleSoftPushDismiss = useCallback(() => {
    setShowSoftPushPrompt(false);
    localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY, Date.now().toString());
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
          monetagRef.current?.sendLiveStartPushNotification(); // Envoyer notification de début de live
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [streamStartsInSeconds, onLiveStart, monetagRef]);

  // Monetag Timeline Logic & Behavioral Triggers
  useEffect(() => {
    const now = Date.now();
    const isPushGranted = ('Notification' in window && Notification.permission === 'granted');
    const lastPushDismissed = localStorage.getItem(PUSH_OPT_IN_DISMISSED_KEY);
    const lastInPagePushShown = localStorage.getItem(IN_PAGE_PUSH_LAST_SHOWN_KEY);

    // T-5 minutes: In-Page Push (via IntersectionObserver)
    // Le déclenchement réel se fera via l'IntersectionObserver sur inPagePushRef

    // T-2 minutes: Native Push Opt-in (via Soft Prompt)
    if (remainingSeconds === 2 * 60 && !showSoftPushPrompt && !isPushGranted && !exitIntentTriggered) {
      if (!lastPushDismissed || (now - parseInt(lastPushDismissed)) > PUSH_PROMPT_COOLDOWN_HOURS * 60 * 60 * 1000) {
        setShowSoftPushPrompt(true);
      }
    }

    // Behavioral Trigger: Exit Intent for Push Opt-in
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 50 && !showSoftPushPrompt && !isPushGranted && !exitIntentTriggered) { // Souris vers le haut de la fenêtre
        if (!lastPushDismissed || (now - parseInt(lastPushDismissed)) > PUSH_PROMPT_COOLDOWN_HOURS * 60 * 60 * 1000) {
          setShowSoftPushPrompt(true);
          setExitIntentTriggered(true); // Pour ne déclencher qu'une fois
          toast.info("Une dernière chose avant de partir !");
        }
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [remainingSeconds, showSoftPushPrompt, exitIntentTriggered, monetagRef]);

  // IntersectionObserver for In-Page Push
  useEffect(() => {
    const now = Date.now();
    const isPushGranted = ('Notification' in window && Notification.permission === 'granted');
    const lastInPagePushShown = localStorage.getItem(IN_PAGE_PUSH_LAST_SHOWN_KEY);

    if (!inPagePushRef.current || inPagePushTriggered || isPushGranted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !inPagePushTriggered && !isPushGranted) {
            if (!lastInPagePushShown || (now - parseInt(lastInPagePushShown)) > IN_PAGE_PUSH_COOLDOWN_HOURS * 60 * 60 * 1000) {
              monetagRef.current?.showInPagePush();
              localStorage.setItem(IN_PAGE_PUSH_LAST_SHOWN_KEY, now.toString());
              setInPagePushTriggered(true);
              toast.info("Découvrez plus de contenu !");
            }
          }
        });
      },
      { threshold: 0.5 } // Déclenche quand 50% de l'élément est visible
    );

    observer.observe(inPagePushRef.current);

    return () => {
      if (inPagePushRef.current) {
        observer.unobserve(inPagePushRef.current);
      }
    };
  }, [inPagePushTriggered, monetagRef]);


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
            <Sparkles className="w-6 h-6 mr-2 animate-pulse" />
          )}
          {hasClickedPlay ? "En attente..." : "Lancer l'attente"}
        </Button>
      </div>

      {/* Placeholder pour l'In-Page Push (garantie CLS) */}
      {/* Cet élément sera observé par IntersectionObserver pour déclencher l'In-Page Push */}
      <div ref={inPagePushRef} className="mt-12 w-full max-w-md mx-auto bg-transparent" style={{ minHeight: '120px' }}>
        {/* Le script Monetag injectera ici son contenu */}
      </div>

      {/* Soft Prompt pour les notifications Push */}
      <PushNotificationSoftPrompt
        isVisible={showSoftPushPrompt}
        onAccept={handleSoftPushAccept}
        onDismiss={handleSoftPushDismiss}
      />
    </div>
  );
};

export default PreLiveEngagement;