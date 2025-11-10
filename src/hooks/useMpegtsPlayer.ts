import { useEffect, useRef, useCallback, RefObject } from 'react';
import mpegts from 'mpegts.js';
import { getProxiedUrl } from '@/utils/player';
import { logError } from '@/utils/analytics';

interface MpegtsPlayerProps {
  videoRef: RefObject<HTMLVideoElement>;
  streamUrl: string;
  autoPlay: boolean;
  userHasInteracted: boolean;
  setIsLoading: (loading: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  setIsMuted: (muted: boolean) => void;
  setIsMutedByBrowser: (muted: boolean) => void;
}

export const useMpegtsPlayer = ({
  videoRef,
  streamUrl,
  autoPlay,
  userHasInteracted,
  setIsLoading,
  setErrorMessage,
  setIsMuted,
  setIsMutedByBrowser,
}: MpegtsPlayerProps) => {
  const mpegtsRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const watchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProgressTimeRef = useRef(Date.now());

  const cleanup = useCallback(() => {
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.destroy();
      } catch (e) { /* ignore */ }
      mpegtsRef.current = null;
    }
  }, []);

  const createMpegtsPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    cleanup();
    setIsLoading(true);
    setErrorMessage(null);
    lastProgressTimeRef.current = Date.now();

    const player = mpegts.createPlayer({
      type: 'mpegts', isLive: true, url: getProxiedUrl(streamUrl),
    }, {
      enableWorker: true, stashInitialSize: 4 * 1024 * 1024,
      liveBufferLatencyChasing: false, fixAudioTimestampGap: true,
    });

    player.attachMediaElement(video);
    player.load();

    player.on(mpegts.Events.ERROR, (type: string, details: string) => {
      console.error('MPEG-TS Error:', type, details);
      logError({
        error_type: type,
        error_details: details,
        stream_url: streamUrl,
        player_type: 'mpegts',
        is_fatal: true, // mpegts.js errors are generally fatal
      });

      if (retryCountRef.current < 5) {
        retryCountRef.current++;
        setTimeout(createMpegtsPlayer, 1000 * retryCountRef.current);
      } else {
        setErrorMessage("Impossible de charger le flux MPEG-TS après plusieurs tentatives.");
      }
    });

    player.on(mpegts.Events.LOADING_COMPLETE, () => setIsLoading(false));
    
    player.on(mpegts.Events.MEDIA_INFO, () => {
      setIsLoading(false);
      if (autoPlay) {
        video.muted = !userHasInteracted;
        const playPromise = player.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            video.muted = true;
            setIsMuted(true);
            setIsMutedByBrowser(true);
            const mutedPlayPromise = player.play();
            if (mutedPlayPromise && typeof mutedPlayPromise.catch === 'function') {
              mutedPlayPromise.catch((e: any) => console.error("MPEG-TS autoplay failed even when muted:", e));
            }
          });
        }
      }
    });

    const handleStreamEnd = () => {
      console.warn("MPEG-TS stream ended unexpectedly. Attempting auto-recovery...");
      createMpegtsPlayer();
    };
    video.addEventListener('ended', handleStreamEnd);

    const handleTimeUpdate = () => {
      lastProgressTimeRef.current = Date.now();
    };
    video.addEventListener('timeupdate', handleTimeUpdate);

    // More aggressive watchdog
    watchdogIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) {
        lastProgressTimeRef.current = Date.now(); // Reset timer if paused or no video
        return;
      }

      const bufferEnd = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
      const bufferAmount = bufferEnd - video.currentTime;
      const timeSinceLastProgress = Date.now() - lastProgressTimeRef.current;

      if (timeSinceLastProgress > 2500 && bufferAmount < 1.5) {
        console.warn(`MPEG-TS stream stalled for >2.5s. Re-initializing player.`);
        lastProgressTimeRef.current = Date.now(); // Reset timer to avoid repeated triggers
        
        if (retryCountRef.current < 5) {
            retryCountRef.current++;
            createMpegtsPlayer();
        } else {
            setErrorMessage("Le flux semble interrompu. Impossible de continuer la lecture.");
            setIsLoading(false);
        }
      }
    }, 1500);

    mpegtsRef.current = player;

    return () => {
      video.removeEventListener('ended', handleStreamEnd);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, streamUrl, autoPlay, cleanup, setIsLoading, setErrorMessage, setIsMuted, setIsMutedByBrowser, userHasInteracted]);

  useEffect(() => {
    let cleanupFunction: (() => void) | undefined;
    if (streamUrl) {
      retryCountRef.current = 0; // Reset retry count for new stream
      cleanupFunction = createMpegtsPlayer();
    }
    return () => {
      cleanup();
      if (cleanupFunction) {
        cleanupFunction();
      }
    };
  }, [streamUrl, createMpegtsPlayer, cleanup]);

  return mpegtsRef;
};