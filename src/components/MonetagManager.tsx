"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

// IDs de zone Monetag
const MONETAG_POP_UNDER_ZONE_ID = '10168808'; // al5sm.com
const MONETAG_IN_PAGE_PUSH_ZONE_ID = '10156178'; // forfrogadiertor.com

interface MonetagManagerRef {
  showPopUnder: () => void;
  showInPagePush: () => void;
  requestPushNotifications: () => void;
  sendLiveStartPushNotification: () => void; // Nouvelle fonction pour les notifications de début de live
}

const MonetagManager = ({ children }: { children?: React.ReactNode }, ref: React.Ref<MonetagManagerRef>) => {
  const scriptsLoaded = useRef(false);
  const popUnderScriptLoaded = useRef(false);
  const inPagePushScriptLoaded = useRef(false);

  const loadScript = useCallback((src: string, id: string, dataset?: Record<string, string>, onLoadCallback?: () => void) => {
    if (document.getElementById(id)) {
      onLoadCallback?.();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-cfasync', 'false');
    if (dataset) {
      for (const key in dataset) {
        script.dataset[key] = dataset[key];
      }
    }
    script.onload = () => {
      console.log(`[Monetag] Script ${id} loaded.`);
      onLoadCallback?.();
    };
    script.onerror = (e) => {
      console.error(`[Monetag] Failed to load script ${id}:`, e);
      toast.error(`Erreur de chargement pub: ${id}`);
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // Utiliser requestIdleCallback pour charger les scripts publicitaires non-critiques
    // afin de ne pas impacter le TTI du lecteur vidéo.
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        console.log('[Monetag] Loading In-Page Push script via requestIdleCallback.');
        loadScript(
          `//forfrogadiertor.com/tag.min.js?z=${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
          `monetag-in-page-push-script-${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
          { zone: MONETAG_IN_PAGE_PUSH_ZONE_ID },
          () => { inPagePushScriptLoaded.current = true; }
        );
      }, { timeout: 2000 }); // Donner 2 secondes pour charger

      (window as any).requestIdleCallback(() => {
        console.log('[Monetag] Loading Pop-under script via requestIdleCallback.');
        loadScript(
          `//al5sm.com/tag.min.js?z=${MONETAG_POP_UNDER_ZONE_ID}`,
          `monetag-pop-under-script-${MONETAG_POP_UNDER_ZONE_ID}`,
          { zone: MONETAG_POP_UNDER_ZONE_ID },
          () => { popUnderScriptLoaded.current = true; }
        );
      }, { timeout: 4000 }); // Donner 4 secondes pour charger
    } else {
      // Fallback pour les navigateurs ne supportant pas requestIdleCallback
      console.log('[Monetag] Loading scripts directly (no requestIdleCallback support).');
      loadScript(
        `//forfrogadiertor.com/tag.min.js?z=${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
        `monetag-in-page-push-script-${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
        { zone: MONETAG_IN_PAGE_PUSH_ZONE_ID },
        () => { inPagePushScriptLoaded.current = true; }
      );
      loadScript(
        `//al5sm.com/tag.min.js?z=${MONETAG_POP_UNDER_ZONE_ID}`,
        `monetag-pop-under-script-${MONETAG_POP_UNDER_ZONE_ID}`,
        { zone: MONETAG_POP_UNDER_ZONE_ID },
        () => { popUnderScriptLoaded.current = true; }
      );
    }

    scriptsLoaded.current = true;
  }, [loadScript]);

  // Exposer les fonctions de déclenchement via ref
  React.useImperativeHandle(ref, () => ({
    showPopUnder: () => {
      if (!popUnderScriptLoaded.current) {
        console.warn('[Monetag] Pop-under script not yet loaded.');
        return;
      }
      try {
        if ((window as any).Monetag && (window as any).Monetag.Popunder) {
          (window as any).Monetag.Popunder.show();
          console.log('[Monetag] Pop-under triggered.');
        } else {
          console.warn('[Monetag] Pop-under API not available.');
        }
      } catch (e) {
        console.error('[Monetag] Error triggering Pop-under:', e);
        toast.error("Erreur pub Pop-under.");
      }
    },
    showInPagePush: () => {
      if (!inPagePushScriptLoaded.current) {
        console.warn('[Monetag] In-Page Push script not yet loaded.');
        return;
      }
      try {
        // L'In-Page Push est généralement géré automatiquement par le script une fois chargé.
        // Si une API de déclenchement manuel existe, elle serait ici.
        // Pour l'instant, nous nous fions au comportement automatique du script.
        console.log('[Monetag] In-Page Push script loaded. It should display automatically based on its configuration.');
        // Si Monetag fournit une API pour le déclencher manuellement:
        // if ((window as any).Monetag && (window as any).Monetag.InPagePush) {
        //   (window as any).Monetag.InPagePush.show();
        // }
      } catch (e) {
        console.error('[Monetag] Error triggering In-Page Push:', e);
        toast.error("Erreur pub In-Page Push.");
      }
    },
    requestPushNotifications: () => {
      // Cette fonction est appelée par notre "soft prompt"
      // Elle déclenche la demande de permission native du navigateur
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            toast.success("Notifications activées !");
            localStorage.setItem('monetag_push_opt_in_accepted', 'true');
            // Ici, vous pourriez appeler une API Monetag si elle existe pour confirmer l'opt-in
            // ou simplement laisser le Service Worker gérer.
          } else {
            toast.info("Notifications refusées.");
          }
        }).catch(e => {
          console.error('[Monetag] Error requesting push permission:', e);
          toast.error("Erreur notifications.");
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        toast.info("Notifications déjà activées.");
        localStorage.setItem('monetag_push_opt_in_accepted', 'true');
      }
    },
    sendLiveStartPushNotification: () => {
      // Cette fonction serait appelée au début du live pour envoyer une notification
      // Nécessite une API côté serveur ou une API Monetag spécifique pour cela.
      // Pour l'instant, c'est un placeholder.
      if ('Notification' in window && Notification.permission === 'granted') {
        // Exemple de notification locale (pourrait être remplacée par une notification serveur)
        new Notification("Le live a commencé !", {
          body: "Le match que vous attendiez est en direct maintenant !",
          icon: "/favicon.png" // Assurez-vous d'avoir une icône
        });
        console.log('[Monetag] Live start notification sent (local example).');
      }
    }
  }));

  return <>{children}</>;
};

export default React.forwardRef(MonetagManager);