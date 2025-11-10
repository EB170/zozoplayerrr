"use client";

import { Play } from 'lucide-react';
import { adStateManager } from '@/lib/adStateManager';

interface AdGateOverlayProps {
  onUnlock: () => void;
}

const MONETAG_POP_UNDER_ZONE_ID = '10168808';

const AdGateOverlay = ({ onUnlock }: AdGateOverlayProps) => {
  
  const handleUnlock = () => {
    // Action 1: Déclencher le Pop-under (la monétisation)
    try {
      const scriptId = 'monetag-pop-under-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `//al5sm.com/tag.min.js?z=${MONETAG_POP_UNDER_ZONE_ID}`;
        script.async = true;
        script.setAttribute('data-cfasync', 'false');
        document.body.appendChild(script);
      }
    } catch (e) {
      console.error("[Ad-Gate] Failed to inject Pop-under script:", e);
    }

    // Action 2: Donner le "pass" de 12h à l'utilisateur
    adStateManager.grantAdGatePass(12);

    // Action 3: Appeler la fonction de déverrouillage du parent pour cacher l'overlay et lancer la vidéo
    onUnlock();
  };

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-20 cursor-pointer" onClick={handleUnlock}>
      <div className="text-center">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary/20 flex items-center justify-center mb-6 transition-transform hover:scale-110 duration-300">
          <Play className="w-12 h-12 md:w-16 md:h-16 text-primary fill-primary" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">ACCÉDER AU DIRECT</h2>
        <p className="text-muted-foreground mt-2">Cliquez pour lancer la lecture</p>
      </div>
    </div>
  );
};

export default AdGateOverlay;