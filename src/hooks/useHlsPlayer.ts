import { useEffect, useRef, useCallback, RefObject } from 'react';
import Hls from 'hls.js';
import { getProxiedUrl } from '@/utils/player';
import { logError } from '@/utils/analytics';

interface HlsPlayerProps {
  videoRef: RefObject<HTMLVideoElement>;
  streamUrl: string;
  autoPlay: boolean;
  userHasInteracted: boolean;
  setIsLoading: (loading: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  setIsMuted: (muted: boolean) => void;
  setIsMutedByBrowser: (muted: boolean) => void;
}

export const useHlsPlayer = ({
  videoRef,
  streamUrl,
  autoPlay,
  userHasInteracted,
  setIsLoading,
  setErrorMessage,
  setIsMuted,
  setIsMutedByBrowser,
}: HlsPlayerProps) => {
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const maintenanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (maintenanceIntervalRef.current) clearInterval(maintenanceIntervalRef.current);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const createHlsPlayer = useCallback(() => {
    const video = videoRef.current;
    if (!video || !Hls.isSupported()) {
      setErrorMessage("HLS non supporté.");
      return;
    }

    cleanup();
    setIsLoading(true);
    setErrorMessage(null);

    const hls = new Hls({
      maxBufferLength: 90,
      maxMaxBufferLength: 120,
      maxBufferSize: 100 * 1000 * 1000, // 100MB
      liveSyncDurationCount: 5,
      liveMaxLatencyDurationCount: 12,
      fragLoadingMaxRetry: 10,
      fragLoadingRetryDelay: 300,
      manifestLoadingMaxRetry: 6,
      levelLoadingMaxRetry: 6,
      abrBandWidthUpFactor: 0.65, // Conservative up-switching
      abrBandWidthFactor: 0.9, // Aggressive down-switching
    });

    hls.loadSource(getProxiedUrl(streamUrl));
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (autoPlay) {
        video.muted = !userHasInteracted;
        video.play().catch(() => {
          video.muted = true;
          setIsMuted(true);
          setIsMutedByBrowser(true);
          video.play();
        });
      }
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      setIsLoading(false);
      retryCountRef.current = 0;
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.error('HLS Error:', data);
      logError({
        error_type: data.type,
        error_details: data.details,
        stream_url: streamUrl,
        player_type: 'hls',
        is_fatal: data.fatal,
      });

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (retryCountRef.current < 5) {
              retryCountRef.current++;
              setTimeout(() => hls.startLoad(), 1000 * retryCountRef.current);
            } else {
              setErrorMessage("Erreur réseau HLS fatale.");
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            createHlsPlayer();
            break;
        }
      }
    });

    hlsRef.current = hls;

    // Long-term maintenance
    maintenanceIntervalRef.current = setInterval(() => {
      if (video && hlsRef.current) {
        // @ts-ignore
        const quality = video.getVideoPlaybackQuality?.();
        if (quality && quality.totalVideoFrames > 100 && (quality.droppedVideoFrames / quality.totalVideoFrames) > 0.08) {
          console.warn("High dropped frame rate, attempting recovery.");
          hlsRef.current.recoverMediaError();
        }
        if (hlsRef.current.media?.buffered.length && (hlsRef.current.media.buffered.end(0) - hlsRef.current.media.currentTime) > 120) {
          console.warn("Buffer too large, performing cleanup.");
          hlsRef.current.stopLoad();
          hlsRef.current.startLoad(video.currentTime);
        }
      }
    }, 15 * 60 * 1000); // Every 15 minutes

  }, [videoRef, streamUrl, autoPlay, cleanup, setIsLoading, setErrorMessage, setIsMuted, setIsMutedByBrowser, userHasInteracted]);

  useEffect(() => {
    if (streamUrl) createHlsPlayer();
    return cleanup;
  }, [streamUrl, createHlsPlayer, cleanup]);

  return hlsRef;
};