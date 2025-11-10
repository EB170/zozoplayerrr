"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { adStateManager } from '@/lib/adStateManager';

const MONETAG_IN_PAGE_PUSH_ZONE_ID = '10156178';
const MONETAG_PUSH_ZONE_ID = '10165926';
const MONETAG_POP_UNDER_ZONE_ID = '10168808';

interface MonetagManagerRef {
  showInPagePush: () => void;
  requestPushNotifications: () => void;
}

const MonetagManager = ({ children }: { children?: React.ReactNode }, ref: React.Ref<MonetagManagerRef>) => {
  const inPagePushScriptLoaded = useRef(false);

  const loadScript = useCallback((src: string, id: string, onLoadCallback?: () => void) => {
    if (document.getElementById(id)) {
      onLoadCallback?.();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.onload = () => {
      console.log(`[Monetag] Script ${id} loaded.`);
      onLoadCallback?.();
    };
    script.onerror = (e) => console.error(`[Monetag] Failed to load script ${id}:`, e);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (adStateManager.isPremium()) return;

    const idleCallbackOptions = { timeout: 3000 };

    const loadAdScripts = () => {
      // Load In-Page Push
      if (adStateManager.canShow('in_page_push')) {
        loadScript(
          `//forfrogadiertor.com/tag.min.js?z=${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
          `monetag-in-page-push-script`,
          () => { inPagePushScriptLoaded.current = true; }
        );
      }
      
      // Pre-load Pop-under script. It will attach itself to click events automatically.
      if (adStateManager.canShow('popunder')) {
         loadScript(
          `//al5sm.com/tag.min.js?z=${MONETAG_POP_UNDER_ZONE_ID}`,
          'monetag-pop-under-script'
        );
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadAdScripts, idleCallbackOptions);
    } else {
      setTimeout(loadAdScripts, 1000);
    }
  }, [loadScript]);

  React.useImperativeHandle(ref, () => ({
    showInPagePush: () => {
      if (adStateManager.canShow('in_page_push') && !adStateManager.hasAcceptedPush()) {
        try {
          if (inPagePushScriptLoaded.current) {
            console.log('[Monetag] In-Page Push should display automatically if conditions are met.');
            adStateManager.markAsShown('in_page_push');
          }
        } catch (e) { console.error('[Monetag] Error with In-Page Push:', e); }
      }
    },
    requestPushNotifications: () => {
      if (adStateManager.canShow('push_prompt') && !adStateManager.hasAcceptedPush()) {
        console.log('[Monetag] Injecting Push Notification script...');
        loadScript(
          `https://3nbf4.com/act/files/tag.min.js?z=${MONETAG_PUSH_ZONE_ID}`,
          'monetag-push-script',
          () => {
            adStateManager.markAsShown('push_prompt');
            // Le script de Monetag gère lui-même le prompt.
            // On peut vérifier le résultat après un court délai pour informer l'utilisateur.
            setTimeout(() => {
              if ('Notification' in window && Notification.permission === 'granted') {
                toast.success("Notifications activées ! Vous serez prévenu des prochains lives.");
              }
            }, 5000); // Vérifie après 5 secondes
          }
        );
      }
    },
  }));

  return <>{children}</>;
};

export default React.forwardRef(MonetagManager);