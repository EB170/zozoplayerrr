"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BellRing, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PushNotificationSoftPromptProps {
  onAccept: () => void;
  onDismiss: () => void;
  isVisible: boolean;
}

const PUSH_OPT_IN_DISMISSED_KEY = 'monetag_push_opt_in_dismissed';

const PushNotificationSoftPrompt = ({ onAccept, onDismiss, isVisible }: PushNotificationSoftPromptProps) => {
  const [showPrompt, setShowPrompt] = useState(isVisible);

  useEffect(() => {
    setShowPrompt(isVisible);
  }, [isVisible]);

  const handleAccept = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY, Date.now().toString()); // Marque comme interagi
    onAccept(); // Déclenche la demande de permission native
  }, [onAccept]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY, Date.now().toString()); // Marque comme refusé/fermé
    onDismiss();
  }, [onDismiss]);

  if (!showPrompt) {
    return null;
  }

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 bg-card border border-primary/50 shadow-lg p-4 max-w-xs text-center space-y-3 animate-in slide-in-from-bottom-4 duration-300 z-[60]",
      "md:bottom-8 md:right-8" // Plus grand sur desktop
    )}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="w-4 h-4" />
      </Button>
      <BellRing className="w-8 h-8 text-primary mx-auto animate-bounce-slow" />
      <p className="font-semibold text-foreground text-base">
        Ne manquez jamais un moment !
      </p>
      <p className="text-sm text-muted-foreground">
        Recevez des notifications instantanées pour les débuts de match et les moments clés.
      </p>
      <Button onClick={handleAccept} className="w-full bg-primary hover:bg-primary/90 text-sm flex items-center justify-center gap-2">
        <CheckCircle className="w-4 h-4" /> Oui, je veux être notifié !
      </Button>
    </Card>
  );
};

export default PushNotificationSoftPrompt;