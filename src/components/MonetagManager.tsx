"use client";

import { useEffect } from 'react';

// Votre ID de zone Monetag pour les formats OnClick, Pop-under, et Vignette
const MONETAG_ZONE_ID = 10165926;

const MonetagManager = () => {
  useEffect(() => {
    // Ce composant ne doit être monté qu'une seule fois au niveau racine de l'application.
    // Il injecte les scripts publicitaires nécessaires de manière permanente pour la session.

    // --- Script Principal Multi-formats (OnClick/Pop-under) ---
    const mainScriptId = `monetag-main-script-${MONETAG_ZONE_ID}`;
    
    if (document.getElementById(mainScriptId)) {
      return; // Le script est déjà présent, on ne fait rien.
    }

    const script = document.createElement('script');
    script.id = mainScriptId;
    script.src = `//forfrogadiertor.com/tag.min.js?z=${MONETAG_ZONE_ID}`;
    script.dataset.zone = String(MONETAG_ZONE_ID);
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    
    document.body.appendChild(script);

    // --- Placeholder pour la Publicité Vignette ---
    const vignetteDivId = `monetag-vignette-${MONETAG_ZONE_ID}`;
    if (!document.getElementById(vignetteDivId)) {
      const vignetteDiv = document.createElement('div');
      vignetteDiv.id = vignetteDivId;
      document.body.appendChild(vignetteDiv);
    }

    // NOTE: Pas de fonction de nettoyage. Le script doit rester actif pendant toute la durée de vie de l'application.
    // Le retirer pourrait désactiver les publicités lors de la navigation ou des re-renderings.

  }, []); // Le tableau vide assure que ce code ne s'exécute qu'une seule fois

  return null; // Ce composant n'affiche rien, il gère juste les scripts
};

export default MonetagManager;