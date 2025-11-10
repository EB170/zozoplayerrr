"use client";

import React, { useEffect, useRef, useCallback } from 'react';

// IDs de zone Monetag
const MONETAG_POP_UNDER_ZONE_ID = '10168808'; // al5sm.com
const MONETAG_IN_PAGE_PUSH_ZONE_ID = '10156178'; // forfrogadiertor.com
// const MONETAG_PUSH_NOTIFICATIONS_ZONE_ID = '10165926'; // 3nbf4.com (géré par sw.js et script dans index.html) // Removed as it's not used directly here

interface MonetagManagerRef {
  showPopUnder: () => void;
  showInPagePush: () => void;
  requestPushNotifications: () => void;
}

const MonetagManager = ({ children }: { children?: React.ReactNode }, ref: React.Ref<MonetagManagerRef>) => {
  const scriptsLoaded = useRef(false);

  const loadScript = useCallback((src: string, id: string, dataset?: Record<string, string>) => {
    if (document.getElementById(id)) {
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true; // Utiliser defer pour ne pas bloquer le rendu
    script.setAttribute('data-cfasync', 'false');
    if (dataset) {
      for (const key in dataset) {
        script.dataset[key] = dataset[key];
      }
    }
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // Charger le script In-Page Push
    loadScript(
      `//forfrogadiertor.com/tag.min.js?z=${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
      `monetag-in-page-push-script-${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
      { zone: MONETAG_IN_PAGE_PUSH_ZONE_ID }
    );

    // Charger le script Pop-under
    loadScript(
      `//al5sm.com/tag.min.js?z=${MONETAG_POP_UNDER_ZONE_ID}`,
      `monetag-pop-under-script-${MONETAG_POP_UNDER_ZONE_ID}`,
      { zone: MONETAG_POP_UNDER_ZONE_ID }
    );

    scriptsLoaded.current = true;
  }, [loadScript]);

  // Exposer les fonctions de déclenchement via ref
  React.useImperativeHandle(ref, () => ({
    showPopUnder: () => {
      if (scriptsLoaded.current && (window as any).Monetag && (window as any).Monetag.Popunder) {
        (window as any).Monetag.Popunder.show();
        console.log('[Monetag] Pop-under triggered.');
      } else {
        console.warn('[Monetag] Pop-under script not ready or API not available.');
      }
    },
    showInPagePush: () => {
      // L'In-Page Push est généralement géré automatiquement par le script une fois chargé.
      // Si une API de déclenchement manuel existe, elle serait ici.
      // Pour l'instant, nous nous fions au comportement automatique du script.
      console.log('[Monetag] In-Page Push script loaded. It should display automatically based on its configuration.');
    },
    requestPushNotifications: () => {
      // Le script de notifications push (3nbf4.com) est chargé via index.html et sw.js.
      // Il gère sa propre logique de demande d'opt-in.
      // Cette fonction est un placeholder pour une éventuelle interaction manuelle.
      console.log('[Monetag] Requesting Push Notifications (handled by main push script).');
    }
  }));

  return <>{children}</>;
};

export default React.forwardRef(MonetagManager);