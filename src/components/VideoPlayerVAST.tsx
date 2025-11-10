"use client";

import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { adStateManager } from '@/lib/adStateManager';
import { toast } from 'sonner';

// Charger les scripts IMA requis
const loadIMAScript = () => {
  if (document.getElementById('ima-sdk')) return;
  const script = document.createElement('script');
  script.id = 'ima-sdk';
  script.src = '//imasdk.googleapis.com/js/sdkloader/ima3.js';
  script.async = true;
  document.head.appendChild(script);
};

const loadIMAContribScript = () => {
  if (document.getElementById('ima-contrib')) return;
  const script = document.createElement('script');
  script.id = 'ima-contrib';
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/videojs-ima/2.1.0/videojs.ima.min.js';
  script.async = true;
  document.head.appendChild(script);
};

interface VideoPlayerVASTProps {
  streamUrl: string;
  vastUrl: string;
  autoPlay?: boolean;
}

const VideoPlayerVAST = ({ streamUrl, vastUrl, autoPlay = true }: VideoPlayerVASTProps) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  useEffect(() => {
    loadIMAScript();
    loadIMAContribScript();
    
    const checkScripts = setInterval(() => {
      if (typeof (window as any).google?.ima && typeof (videojs as any).getPlugin === 'function') {
        setScriptsLoaded(true);
        clearInterval(checkScripts);
      }
    }, 100);

    return () => clearInterval(checkScripts);
  }, []);

  useEffect(() => {
    if (!scriptsLoaded || !videoRef.current || !streamUrl) {
      return;
    }

    // Détruire l'instance précédente si elle existe
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-default-skin', 'vjs-big-play-centered');
    videoRef.current.appendChild(videoElement);

    const player = playerRef.current = videojs(videoElement, {
      autoplay: autoPlay,
      controls: true,
      responsive: true,
      fluid: true,
      playsinline: true,
      muted: !autoPlay, // L'autoplay avec son est souvent bloqué
    });

    const imaOptions = {
      id: 'ima-plugin',
      adTagUrl: vastUrl,
      adWillPlayMuted: !autoPlay,
    };

    player.ima(imaOptions);

    player.on('adserror', (event: any) => {
      console.error('IMA Error:', event);
      toast.error("La publicité n'a pas pu être chargée.", { description: "Le contenu va démarrer directement." });
      player.src({ src: streamUrl });
    });

    player.on('adend', () => {
      adStateManager.markSessionPrerollAsSeen();
      console.log('[AdManager] Pre-roll vu, session marquée.');
    });

    // Le plugin IMA gère le passage de la pub au contenu.
    // Nous définissons la source du contenu principal.
    player.src({ src: streamUrl });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [streamUrl, vastUrl, autoPlay, scriptsLoaded]);

  return (
    <div data-vjs-player>
      <div ref={videoRef} />
    </div>
  );
};

export default VideoPlayerVAST;