"use client";

import { useRef, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { detectStreamType } from '@/utils/player';
import { Loader2, AlertTriangle, VolumeX } from 'lucide-react';
import { useHlsPlayer } from '@/hooks/useHlsPlayer';
import { useMpegtsPlayer } from '@/hooks/useMpegtsPlayer';
import { usePlayerState } from '@/hooks/usePlayerState';
import { Button } from './ui/button';

interface VideoPlayerHybridProps {
  streamUrl: string;
  autoPlay?: boolean;
}

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
}

const VideoPlayerHybrid = forwardRef<VideoPlayerRef, VideoPlayerHybridProps>(({ streamUrl, autoPlay = false }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userHasInteracted, setUserHasInteracted] = useState(false);

  const {
    isLoading,
    isMutedByBrowser,
    setIsLoading,
    setIsMuted,
    setIsMutedByBrowser,
    unmuteByBrowser,
  } = usePlayerState(videoRef);

  const streamType = detectStreamType(streamUrl);

  const commonPlayerProps = {
    videoRef,
    streamUrl,
    autoPlay,
    userHasInteracted,
    setIsLoading,
    setErrorMessage,
    setIsMuted,
    setIsMutedByBrowser,
  };

  useHlsPlayer(streamType === 'hls' ? commonPlayerProps : { ...commonPlayerProps, streamUrl: '' });
  useMpegtsPlayer(streamType === 'mpegts' ? commonPlayerProps : { ...commonPlayerProps, streamUrl: '' });

  useEffect(() => {
    const handleInteraction = () => {
      setUserHasInteracted(true);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play().catch(e => console.error("Play failed", e)),
    pause: () => videoRef.current?.pause(),
  }));

  return (
    <div className="w-full h-full relative bg-black text-white">
      <video ref={videoRef} className="w-full h-full" controls playsInline />

      {isLoading && !errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      {errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 p-4 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
          <p className="font-semibold">Erreur de chargement du flux</p>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      )}

      {isMutedByBrowser && (
        <div className="absolute top-4 left-4 z-10">
          <Button onClick={unmuteByBrowser} variant="secondary" size="sm" className="bg-black/50 hover:bg-black/80">
            <VolumeX className="w-4 h-4 mr-2" />
            Son désactivé par le navigateur. Cliquez pour réactiver.
          </Button>
        </div>
      )}
    </div>
  );
});

export default VideoPlayerHybrid;