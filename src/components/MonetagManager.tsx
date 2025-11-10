"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { adStateManager } from '@/lib/adStateManager'; // Import du manager

const MONETAG_POP_UNDER_ZONE_ID = '10168808';
const MONETAG_IN_PAGE_PUSH_ZONE_ID = '10156178';

interface MonetagManagerRef {
  showPopUnder: () => void;
  showInPagePush: () => void;
  requestPushNotifications: () => void;
  sendLiveStartPushNotification: () => void;
}

const MonetagManager = ({ children }: { children?: React.ReactNode }, ref: React.Ref<MonetagManagerRef>) => {
  const popUnderScriptLoaded = useRef(false);
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
    script.defer = true;
    script.setAttribute('data-cfasync', 'false');
    script.onload = () => {
      console.log(`[Monetag] Script ${id} loaded.`);
      onLoadCallback?.();
    };
    script.onerror = (e) => console.error(`[Monetag] Failed to load script ${id}:`, e);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (adStateManager.isPremium()) return; // Ne rien charger pour les Premium

    const idleCallbackOptions = { timeout: 3000 };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        // Charger In-Page Push uniquement si autorisé
        if (adStateManager.canShow('in_page_push')) {
          loadScript(
            `//forfrogadiertor.com/tag.min.js?z=${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
            `monetag-in-page-push-script`,
            () => { inPagePushScriptLoaded.current = true; }
          );
        }
        // Charger Pop-under uniquement si autorisé
        if (adStateManager.canShow('popunder')) {
          loadScript(
            `//al5sm.com/tag.min.js?z=${MONETAG_POP_UNDER_ZONE_ID}`,
            `monetag-pop-under-script`,
            () => { popUnderScriptLoaded.current = true; }
          );
        }
      }, idleCallbackOptions);
    } else {
      // Fallback pour anciens navigateurs
      setTimeout(() => {
        if (adStateManager.canShow('in_page_push')) loadScript(`//forfrogadiertor.com/tag.min.js?z=${MONETAG_IN_PAGE_PUSH_ZONE_ID}`, `monetag-in-page-push-script`, () => { inPagePushScriptLoaded.current = true; });
        if (adStateManager.canShow('popunder')) loadScript(`//al5sm.com/tag.min.js?z=${MONETAG_POP_UNDER_ZONE_ID}`, `monetag-pop-under-script`, () => { popUnderScriptLoaded.current = true; });
      }, 1000);
    }
  }, [loadScript]);

  React.useImperativeHandle(ref, () => ({
    showPopUnder: () => {
      if (adStateManager.canShow('popunder')) {
        try {
          if (popUnderScriptLoaded.current && (window as any).Monetag?.Popunder) {
            (window as any).Monetag.Popunder.show();
            adStateManager.markAsShown('popunder');
            console.log('[Monetag] Pop-under triggered.');
          }
        } catch (e) { console.error('[Monetag] Error triggering Pop-under:', e); }
      }
    },
    showInPagePush: () => {
      if (adStateManager.canShow('in_page_push') && !adStateManager.hasAcceptedPush()) {
        try {
          if (inPagePushScriptLoaded.current) {
            console.log('[Monetag] In-Page Push should display automatically.');
            adStateManager.markAsShown('in_page_push');
          }
        } catch (e) { console.error('[Monetag] Error with In-Page Push:', e); }
      }
    },
    requestPushNotifications: () => {
      if (adStateManager.canShow('push_prompt')) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            toast.success("Notifications activées !");
            adStateManager.markAsShown('push_prompt'); // Marque comme interagi
          } else {
            toast.info("Notifications refusées.");
            adStateManager.markAsShown('push_prompt'); // Marque comme interagi pour le capping
          }
        });
      }
    },
    sendLiveStartPushNotification: () => {
      if (adStateManager.hasAcceptedPush()) {
        try {
          new Notification("Le live a commencé !", {
            body: "Le match que vous attendiez est en direct maintenant !",
            icon: "/favicon.png"
          });
        } catch (e) { console.error('[Monetag] Error sending local notification:', e); }
      }
    }
  }));

  return <>{children}</>;
};

export default React.forwardRef(MonetagManager);