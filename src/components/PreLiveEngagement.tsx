"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Tv, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import PushNotificationSoftPrompt from './PushNotificationSoftPrompt';
import { adStateManager } from '@/lib/adStateManager';

interface PreLiveEngagementProps {
  streamStartsInSeconds: number;
  onLiveStart: () => void;
  onPlayClick: () => void;
  monetagRef: React.RefObject<{
    showPopUnder: () => void;
    showInPagePush: () => void;
    requestPushNotifications: () => void;
    sendLiveStartPushNotification: () => void;
  }>;
}

const PreLiveEngagement = ({ streamStartsInSeconds, onLiveStart, onPlayClick, monetagRef }: PreLiveEngagementProps) => {
  const [remainingSeconds, setRemainingSeconds] = useState(streamStartsInSeconds);
  const [hasClickedPlay, setHasClickedPlay] = useState(false);
  const [showSoftPushPrompt, setShowSoftPushPrompt] = useState(false);
  const [exitIntentTriggered, setExitIntentTriggered] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inPagePushRef = useRef<HTMLDivElement>(null);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayButtonClick = useCallback(() => {
    if (!hasClickedPlay) {
      setHasClickedPlay(true);
      onPlayClick(); // Utiliser la prop passée par le parent
      toast.info("Le live commencera bientôt !");
    }
  }, [hasClickedPlay, onPlayClick]);

  const handleSoftPushAccept = useCallback(() => {
    setShowSoftPushPrompt(false);
    monetagRef.current?.requestPushNotifications();
  }, [monetagRef]);

  const handleSoftPushDismiss = useCallback(() => {
    setShowSoftPushPrompt(false);
    adStateManager.markAsShown('push_prompt');
    toast.info("Notifications désactivées pour l'instant.");
  }, []);

  useEffect(() => {
    setRemainingSeconds(streamStartsInSeconds);
    if (streamStartsInSeconds <= 0) {
      onLiveStart();
      return;
    }
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onLiveStart();
          monetagRef.current?.sendLiveStartPushNotification();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerRef.current = interval;
    return () => clearInterval(interval);
  }, [streamStartsInSeconds, onLiveStart, monetagRef]);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 50 && !exitIntentTriggered && adStateManager.canShow('push_prompt')) {
        setShowSoftPushPrompt(true);
        setExitIntentTriggered(true);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [exitIntentTriggered]);

  useEffect(() => {
    if (!inPagePushRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          monetagRef.current?.showInPagePush();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(inPagePushRef.current);
    return () => observer.disconnect();
  }, [monetagRef]);

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
          {hasClickedPlay ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Sparkles className="w-6 h-6 mr-2 animate-pulse" />}
          {hasClickedPlay ? "En attente..." : "Lancer l'attente"}
        </Button>
      </div>
      <div ref={inPagePushRef} className="absolute bottom-0 w-full" style={{ height: '120px' }} />
      <PushNotificationSoftPrompt
        isVisible={showSoftPushPrompt}
        onAccept={handleSoftPushAccept}
        onDismiss={handleSoftPushDismiss}
      />
    </div>
  );
};

export default PreLiveEngagement;