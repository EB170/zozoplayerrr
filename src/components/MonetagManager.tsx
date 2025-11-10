"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { adStateManager } from '@/lib/adStateManager';

const MONETAG_IN_PAGE_PUSH_ZONE_ID = '10156178';

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
    if (adStateManager.isPremium()) return;

    const idleCallbackOptions = { timeout: 3000 };

    const loadInPagePush = () => {
      if (adStateManager.canShow('in_page_push')) {
        loadScript(
          `//forfrogadiertor.com/tag.min.js?z=${MONETAG_IN_PAGE_PUSH_ZONE_ID}`,
          `monetag-in-page-push-script`,
          () => { inPagePushScriptLoaded.current = true; }
        );
      }
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(loadInPagePush, idleCallbackOptions);
    } else {
      setTimeout(loadInPagePush, 1000);
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
        // Using a soft prompt approach would be better here, but for directness:
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            toast.success("Notifications activées ! Vous serez prévenu des prochains lives.");
            adStateManager.markAsShown('push_prompt');
          } else {
            toast.info("Vous avez refusé les notifications.");
            adStateManager.markAsShown('push_prompt');
          }
        });
      }
    },
  }));

  return <>{children}</>;
};

export default React.forwardRef(MonetagManager);