import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, Rewind, FastForward } from "lucide-react";
import { Button } from "./ui/button";
import { usePlayerState } from "@/hooks/usePlayerState";
import { useHlsPlayer } from "@/hooks/useHlsPlayer";
import { useMpegtsPlayer } from "@/hooks/useMpegtsPlayer";
import { toast } from "sonner";
import { detectStreamType, PlayerType } from "@/utils/player";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  streamUrl: string;
  autoPlay?: boolean;
  userHasInteracted: boolean;
}

export interface VideoPlayerHybridRef {
  videoElement: HTMLVideoElement | null;
}

export const VideoPlayerHybrid = forwardRef<VideoPlayerHybridRef, VideoPlayerProps>(({ streamUrl, autoPlay = true, userHasInteracted }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<any>(null);
  
  const [playerType, setPlayerType] = useState<PlayerType>('mpegts');
  const [showControls, setShowControls] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seekIndicator, setSeekIndicator] = useState<'forward' | 'backward' | null>(null);
  
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout>();

  useImperativeHandle(ref, () => ({
    videoElement: videoRef.current,
  }));

  const {
    isPlaying, isLoading, isMuted,
    setIsLoading, setIsMuted, setIsMutedByBrowser, togglePlayPause,
    toggleMute,
  } = usePlayerState(videoRef);

  // Screen Wake Lock
  useEffect(() => {
    const acquireWakeLock = async () => {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.error(`Wake Lock failed: ${(err as Error).message}`);
        }
      }
    };

    const releaseWakeLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    if (isPlaying) {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => releaseWakeLock();
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'KeyF':
          handleFullscreen();
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'ArrowRight':
          if (videoRef.current) videoRef.current.currentTime += 10;
          break;
        case 'ArrowLeft':
          if (videoRef.current) videoRef.current.currentTime -= 10;
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, toggleMute]);

  useEffect(() => {
    setPlayerType(detectStreamType(streamUrl));
  }, [streamUrl]);

  useHlsPlayer({
    videoRef, streamUrl: playerType === 'hls' ? streamUrl : '', autoPlay, userHasInteracted,
    setIsLoading, setErrorMessage, setIsMuted, setIsMutedByBrowser,
  });

  useMpegtsPlayer({
    videoRef, streamUrl: playerType === 'mpegts' ? streamUrl : '', autoPlay, userHasInteracted,
    setIsLoading, setErrorMessage, setIsMuted, setIsMutedByBrowser,
  });

  const handleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const isFullscreen = document.fullscreenElement || (video as any).webkitDisplayingFullscreen;

    if (isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((video as any).webkitExitFullscreen) {
        (video as any).webkitExitFullscreen();
      }
    } else {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          if ((video as any).webkitEnterFullscreen) {
            (video as any).webkitEnterFullscreen();
          } else {
            toast.error("Plein écran non supporté sur cet appareil.");
          }
        });
      } else if ((video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
      } else {
        toast.error("Plein écran non supporté sur cet appareil.");
      }
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const handleTap = () => {
    setShowControls(c => !c);
  };

  const handleDoubleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    
    if (tapX < rect.width / 2) {
      video.currentTime -= 10;
      setSeekIndicator('backward');
    } else {
      video.currentTime += 10;
      setSeekIndicator('forward');
    }
    setTimeout(() => setSeekIndicator(null), 500);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black" onMouseMove={handleMouseMove} onMouseLeave={() => isPlaying && setShowControls(false)}>
      <video ref={videoRef} className="w-full h-full object-contain" playsInline preload="auto" webkit-playsinline="true" />
      
      <div className="absolute inset-0 md:hidden" onClick={handleTap} onDoubleClick={handleDoubleTap} />

      {seekIndicator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 rounded-full p-4 animate-in fade-in zoom-in-50 duration-300">
            {seekIndicator === 'forward' ? <FastForward className="w-8 h-8 text-white" /> : <Rewind className="w-8 h-8 text-white" />}
          </div>
        </div>
      )}
      
      {isLoading && !errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
        </div>
      )}
      
      {errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-40">
          <div className="text-center text-white p-4">
            <p className="font-bold text-lg">⚠️ Erreur de lecture</p>
            <p className="text-sm mb-4">{errorMessage}</p>
            <Button onClick={() => window.location.reload()}>Recharger la page</Button>
          </div>
        </div>
      )}

      {showControls && !errorMessage && (
        <div className={cn("absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 z-30 transition-opacity duration-300", isPlaying ? "opacity-100" : "opacity-100")}>
          <div className="flex items-center gap-2 md:gap-4 h-12 md:h-auto">
            <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-white hover:bg-white/20 w-10 h-10 md:w-auto md:h-auto"><>{isPlaying ? <Pause className="w-8 h-8 md:w-6 md:h-6" /> : <Play className="w-8 h-8 md:w-6 md:h-6" />}</></Button>
            
            <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20 w-10 h-10 md:w-auto md:h-auto"><>{isMuted ? <VolumeX className="w-6 h-6 md:w-5 md:h-5" /> : <Volume2 className="w-6 h-6 md:w-5 md:h-5" />}</></Button>

            <div className="flex-1" />
            
            <Button variant="ghost" size="icon" onClick={handleFullscreen} className="text-white hover:bg-white/20 w-10 h-10 md:w-auto md:h-auto"><Maximize className="w-6 h-6 md:w-5 md:h-5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
});