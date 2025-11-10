"use client";

import { Play } from 'lucide-react';

interface AdGateOverlayProps {
  onUnlock: () => void;
}

const AdGateOverlay = ({ onUnlock }: AdGateOverlayProps) => {
  
  const handleUnlock = () => {
    // Le script pop-under est maintenant pré-chargé par MonetagManager.
    // Il se déclenchera automatiquement sur ce clic.
    // Nous n'avons plus besoin d'injecter le script ici.
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