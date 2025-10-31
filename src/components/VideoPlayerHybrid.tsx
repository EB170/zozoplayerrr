import { useEffect, useRef, useState, useCallback } from "react";
import mpegts from "mpegts.js";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2, PictureInPicture, BarChart3, Settings as SettingsIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { PlayerStats } from "./PlayerStats";
import { PlayerSettings } from "./PlayerSettings";
import { QualityIndicator } from "./QualityIndicator";
import { useRealBandwidth } from "@/hooks/useRealBandwidth";
import { useVideoMetrics } from "@/hooks/useVideoMetrics";
import { useHealthMonitor } from "@/hooks/useHealthMonitor";
import { parseHLSManifest, StreamQuality } from "@/utils/manifestParser";
import { toast } from "sonner";
import { VASTClient } from '@dailymotion/vast-client';

interface VideoPlayerProps {
  streamUrl: string;
  vastUrl?: string;
  autoPlay?: boolean;
}

type PlayerType = 'mpegts' | 'hls';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const getProxiedUrl = (originalUrl: string, type: 'stream' | 'vast' | 'vast-tracking' = 'stream'): string => {
  console.log('DEBUG: getProxiedUrl received originalUrl:', originalUrl, 'type:', typeof originalUrl, 'requestType:', type);
  
  if (!SUPABASE_PROJECT_ID || typeof SUPABASE_PROJECT_ID !== 'string' || SUPABASE_PROJECT_ID.trim() === '') {
    const errorMsg = 'CRITICAL ERROR: SUPABASE_PROJECT_ID is not defined or is invalid. Please set VITE_SUPABASE_PROJECT_ID in your environment variables.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log('DEBUG: Using Supabase Project ID:', SUPABASE_PROJECT_ID);
  const proxyUrl = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stream-proxy`;
  const finalUrl = `${proxyUrl}?url=${encodeURIComponent(String(originalUrl))}&type=${type}`;
  console.log('DEBUG: getProxiedUrl returning finalUrl:', finalUrl);
  return finalUrl;
};

const detectStreamType = (url: string): PlayerType => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.m3u8') || urlLower.includes('m3u8')) {
    return 'hls';
  }
  if (urlLower.includes('.ts') || urlLower.includes('extension=ts')) {
    return 'mpegts';
  }
  return 'mpegts';
};

const getNetworkSpeed = (): 'fast' | 'medium' | 'slow' => {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType === '4g' || effectiveType === '5g') return 'fast';
    if (effectiveType === '3g') return 'medium';
    return 'slow';
  }
  return 'fast';
};

const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

export const VideoPlayerHybrid = ({
  streamUrl,
  vastUrl,
  autoPlay = true
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const mpegtsRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef(0);
  const lastTapSideRef = useRef<'left' | 'right' | null>(null);
  const playerTypeRef = useRef<PlayerType>('mpegts');
  const useProxyRef = useRef(false);
  const fragErrorCountRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const hlsDebugMode = useRef(false);
  const memoryCleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uptimeStartRef = useRef<number>(Date.now());
  const lastMemoryCleanupRef = useRef<number>(Date.now());
  const playbackQualityCheckRef = useRef<number>(0);
  const adCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const userInteractedRef = useRef(false);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maintenanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mpegtsStallRecoveryAttemptsRef = useRef(0);
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bufferHealth, setBufferHealth] = useState(100);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState('auto');
  const [showSeekFeedback, setShowSeekFeedback] = useState<{
    direction: 'forward' | 'backward';
    show: boolean;
  }>({
    direction: 'forward',
    show: false
  });
  const [availableQualities, setAvailableQualities] = useState<StreamQuality[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [adPlaying, setAdPlaying] = useState(false);
  const [adTimeRemaining, setAdTimeRemaining] = useState(0);
  const [adSkippable, setAdSkippable] = useState(false);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout>();
  const videoMetrics = useVideoMetrics(videoRef.current);
  const realBandwidth = useRealBandwidth();
  const {
    health: healthStatus
  } = useHealthMonitor(videoRef.current);
  const networkSpeed = getNetworkSpeed();

  const cleanup = useCallback(() => {
    console.log("[Player] Full cleanup initiated");
    const video = videoRef.current;
    
    if (adVideoRef.current) {
      adVideoRef.current.pause();
      adVideoRef.current.src = '';
      adVideoRef.current.load();
    }
    setAdPlaying(false);
    setAdSkippable(false);
    setAdTimeRemaining(0);
    
    if (adCountdownIntervalRef.current) {
      clearInterval(adCountdownIntervalRef.current);
      adCountdownIntervalRef.current = null;
    }
    
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    if (maintenanceIntervalRef.current) {
      clearInterval(maintenanceIntervalRef.current);
      maintenanceIntervalRef.current = null;
    }
    
    if (mpegtsRef.current) {
      const watchdog = (mpegtsRef.current as any)._watchdogInterval;
      if (watchdog) {
        clearInterval(watchdog);
        (mpegtsRef.current as any)._watchdogInterval = null;
      }
      const maintenance = (mpegtsRef.current as any)._maintenanceInterval;
      if (maintenance) {
        clearInterval(maintenance);
        (mpegtsRef.current as any)._maintenanceInterval = null;
      }
      
      try {
        mpegtsRef.current.pause();
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch (e) {
        console.warn('[Player] MPEGTS cleanup warning:', e);
      }
      mpegtsRef.current = null;
    }
    
    if (hlsRef.current) {
      const maintenance = (hlsRef.current as any)._maintenanceInterval;
      if (maintenance) {
        clearInterval(maintenance);
        (hlsRef.current as any)._maintenanceInterval = null;
      }
      const liveEdge = (hlsRef.current as any)._liveEdgeInterval;
      if (liveEdge) {
        clearInterval(liveEdge);
        (hlsRef.current as any)._liveEdgeInterval = null;
      }
      
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
      } catch (e) {
        console.warn('[Player] HLS cleanup warning:', e);
      }
      hlsRef.current = null;
    }
    
    console.log("[Player] Cleanup completed");
  }, []);

  const scheduleRetry = useCallback((retryFn: () => void) => {
    if (retryCountRef.current >= 5) {
      console.error('❌ Max retries reached');
      setErrorMessage("Impossible de charger le flux après plusieurs tentatives");
      toast.error("Échec de chargement", {
        description: "Le flux est actuellement indisponible",
        duration: 5000
      });
      setIsInitializing(false);
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
    retryCountRef.current++;
    console.log(`🔄 Retry ${retryCountRef.current}/5 in ${delay}ms`);
    retryTimeoutRef.current = setTimeout(() => {
      retryFn();
    }, delay);
  }, [setIsInitializing]);

  const getOptimalBufferSize = useCallback(() => {
    const bandwidth = realBandwidth.averageBitrate || 10;
    let baseSize = 1024;
    if (bandwidth > 10) baseSize = 1536;else if (bandwidth > 6) baseSize = 1024;else if (bandwidth > 3) baseSize = 768;else baseSize = 512;
    if (networkSpeed === 'slow') baseSize = Math.round(baseSize * 0.7);else if (networkSpeed === 'fast') baseSize = Math.round(baseSize * 1.3);
    return baseSize;
  }, [realBandwidth.averageBitrate, networkSpeed]);

  const createMpegtsPlayer = useCallback((urlToLoad: string) => {
    const video = videoRef.current;
    if (!video) {
      setIsInitializing(false);
      return;
    }
    
    video.src = '';
    
    console.log('🎬 Creating MPEGTS player...');
    
    const isHttpsPage = window.location.protocol === 'https:';
    const isHttpStream = urlToLoad.toLowerCase().startsWith('http://');
    
    if (isHttpsPage && isHttpStream && !useProxyRef.current) {
      console.log('🔒 Mixed Content detected, using proxy automatically');
      useProxyRef.current = true;
    }
    
    let finalUrl: string;
    try {
      finalUrl = useProxyRef.current ? getProxiedUrl(urlToLoad, 'stream') : urlToLoad;
    } catch (error: any) {
      console.error('CRITICAL ERROR: Failed to get proxied URL for MPEG-TS:', error.message);
      setErrorMessage(`Erreur de configuration du proxy: ${error.message}. Veuillez vérifier vos variables d'environnement.`);
      setIsLoading(false);
      setIsInitializing(false);
      return;
    }

    console.log('CRITICAL DEBUG: URL before mpegts.createPlayer:', finalUrl, 'type:', typeof finalUrl);
    if (typeof finalUrl !== 'string' || !finalUrl) {
      console.error('CRITICAL ERROR: finalUrl is NOT a string or is empty before mpegts.createPlayer:', finalUrl);
      setErrorMessage('Erreur interne critique: URL du flux MPEG-TS invalide ou vide.');
      setIsInitializing(false);
      return;
    }

    const player = mpegts.createPlayer({
      type: 'mpegts',
      isLive: true,
      url: finalUrl,
      cors: true,
      withCredentials: false
    }, {
      enableWorker: true,
      enableStashBuffer: true,
      stashInitialSize: 4 * 1024 * 1024,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 60,
      autoCleanupMinBackwardDuration: 30,
      liveBufferLatencyChasing: false,
      liveBufferLatencyMaxLatency: 60,
      liveBufferLatencyMinRemain: 20,
      fixAudioTimestampGap: true,
      lazyLoad: false,
      deferLoadAfterSourceOpen: false,
      accurateSeek: false,
      seekType: 'range',
      isLive: true,
      reuseRedirectedURL: true
    });
    player.on(mpegts.Events.ERROR, (errorType: string, errorDetail: any) => {
      console.error('🔴 MPEGTS Error:', errorType, errorDetail);

      if (!useProxyRef.current && errorType === mpegts.ErrorTypes.NETWORK_ERROR) {
        console.log('🔄 Switching to proxy...');
        useProxyRef.current = true;
        cleanup();
        scheduleRetry(() => createMpegtsPlayer(urlToLoad));
      } else {
        if (errorType === mpegts.ErrorTypes.NETWORK_ERROR && errorDetail.code === 404) {
          setErrorMessage("Erreur 404 du proxy Supabase. Veuillez vérifier les logs de votre fonction Edge Function sur Supabase.");
          toast.error("Proxy Supabase introuvable", {
            description: "Vérifiez le déploiement et les logs de votre fonction Edge Function.",
            duration: 8000
          });
        }
        cleanup();
        scheduleRetry(() => createMpegtsPlayer(urlToLoad));
      }
    });
    player.on(mpegts.Events.LOADING_COMPLETE, () => {
      console.log('✅ MPEGTS loading complete');
    });
    player.on(mpegts.Events.METADATA_ARRIVED, () => {
      console.log('📊 Metadata arrived');
    });
    player.attachMediaElement(video);
    player.load();
    mpegtsRef.current = player;
    
    const watchdogInterval = setInterval(() => {
      if (!video || video.readyState < 2) return;
      
      const bufferLevel = video.buffered.length > 0 
        ? video.buffered.end(0) - video.currentTime 
        : 0;
      
      if (bufferLevel >= 5) {
        mpegtsStallRecoveryAttemptsRef.current = 0;
      }

      if (bufferLevel < 5 && !video.paused) {
        console.warn(`🚨 Buffer critique (${bufferLevel.toFixed(2)}s), recovery immédiat...`);
        mpegtsStallRecoveryAttemptsRef.current++;

        if (mpegtsStallRecoveryAttemptsRef.current < 3) {
          console.log(`🔧 Tentative de récupération douce (${mpegtsStallRecoveryAttemptsRef.current}/3)...`);
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.currentTime = Math.max(0, video.currentTime + 0.1);
          }
        } else {
          console.warn('🔄 Tentatives de récupération douce épuisées, rechargement complet...');
          try {
            if (player && typeof player.unload === 'function') {
              const currentTime = video.currentTime;
              player.unload();
              player.load();
              video.currentTime = Math.max(0, currentTime - 0.5);
              video.play().catch(() => {});
              mpegtsStallRecoveryAttemptsRef.current = 0;
            }
          } catch (e) {
            console.error('Recovery failed:', e);
          }
        }
      }
      
      const now = Date.now();
      if (!video.paused && video.currentTime === (video as any)._lastCurrentTime) {
        const frozenTime = now - ((video as any)._lastTimeUpdate || now);
        if (frozenTime > 1500) {
          console.warn('🚨 Vidéo gelée détectée, recovery multi-étapes...');
          
          video.play().catch(() => {
            console.warn('🔄 Simple play() échoué, reload complet...');
            try {
              if (player && typeof player.unload === 'function') {
                const currentTime = video.currentTime;
                player.unload();
                player.load();
                video.currentTime = currentTime;
                video.play().catch(() => {});
              }
            } catch (e) {
              console.error('Full reload failed:', e);
            }
          });
          
          (video as any)._lastTimeUpdate = now;
        }
      } else {
        (video as any)._lastCurrentTime = video.currentTime;
        (video as any)._lastTimeUpdate = now;
      }
      
      if (video.readyState === 2 && !video.paused) {
        console.warn('⚠️ ReadyState=2 détecté, préchargement insuffisant');
      }
    }, 1000);
    
    (player as any)._watchdogInterval = watchdogInterval;
    
    const maintenanceInterval = setInterval(() => {
      if (!video || !player) return;
      
      const uptimeMinutes = (Date.now() - uptimeStartRef.current) / 1000 / 60;
      console.log(`🔧 Maintenance préventive (uptime: ${uptimeMinutes.toFixed(1)}min)`);
      
      try {
        const quality = (video as any).getVideoPlaybackQuality?.();
        if (quality) {
          const dropRate = quality.droppedVideoFrames / (quality.totalVideoFrames || 1);
          playbackQualityCheckRef.current++;
          
          if (dropRate > 0.05 && playbackQualityCheckRef.current > 3) {
            console.warn(`⚠️ Qualité dégradée (${(dropRate * 100).toFixed(1)}% frames perdus), soft reload...`);
            try {
              const currentTime = video.currentTime;
              player.unload();
              player.load();
              video.currentTime = currentTime;
              video.play().catch(() => {});
              playbackQualityCheckRef.current = 0;
            } catch (e) {
              console.error('Soft reload failed:', e);
            }
          }
        }
        
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const bufferedStart = video.buffered.start(0);
          const totalBuffered = bufferedEnd - bufferedStart;
          
          if (totalBuffered > 90) {
            console.log(`🧹 Buffer trop grand (${totalBuffered.toFixed(1)}s), cleanup...`);
            try {
              const currentTime = video.currentTime;
              player.unload();
              player.load();
              video.currentTime = currentTime;
              video.play().catch(() => {});
            } catch (e) {}
          }
        }
        
        lastMemoryCleanupRef.current = Date.now();
      } catch (e) {
        console.warn('Maintenance error:', e);
      }
    }, 20 * 60 * 1000);
    
    (player as any)._maintenanceInterval = maintenanceInterval;
    memoryCleanupIntervalRef.current = maintenanceInterval;
    
    if (autoPlay) {
      setTimeout(() => {
        video.play().then(() => {
          console.log('✅ MPEGTS playback started');
          retryCountRef.current = 0;
          setErrorMessage(null);
          toast.success("✅ Lecture démarrée", {
            description: `MPEG-TS • ${networkSpeed}`,
            duration: 2000
          });
          setIsInitializing(false);
        }).catch(err => {
          if (err.name !== 'AbortError') {
            console.error('❌ Play failed:', err);
            toast.error("Échec de lecture", {
              description: "Le flux n'a pas pu démarrer automatiquement.",
              duration: 3000
            });
            scheduleRetry(() => createMpegtsPlayer(urlToLoad));
          } else {
            setIsInitializing(false);
          }
        });
      }, 500);
    } else {
      setIsInitializing(false);
    }
  }, [autoPlay, cleanup, scheduleRetry, getOptimalBufferSize, networkSpeed, setIsInitializing]);

  // Helper function for HLS event handlers
  const setupHlsEventHandlers = useCallback((hls: Hls, currentStreamUrl: string, createHlsPlayerFn: (url: string) => void) => {
    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      const qualities: StreamQuality[] = data.levels.map((level: any, index: number) => ({
        id: `level-${index}`,
        label: `${level.height}p`,
        bandwidth: level.bitrate,
        resolution: `${level.width}x${level.height}`,
        url: ''
      }));
      setAvailableQualities(qualities);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      setCurrentLevel(data.level);
    });

    hls.on(Hls.Events.FRAG_LOADED, () => {
      fragErrorCountRef.current = 0;
      setIsLoading(false);
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (!data.fatal) return;
      
      if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || 
          data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
        fragErrorCountRef.current++;
        if (fragErrorCountRef.current <= 6) {
          const delay = 500 * Math.pow(1.5, fragErrorCountRef.current - 1);
          setTimeout(() => hls.startLoad(), delay);
          return;
        }
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try {
          hls.recoverMediaError();
        } catch (e) {
          cleanup();
          setTimeout(() => createHlsPlayerFn(currentStreamUrl), 500);
        }
      }
    });
  }, [cleanup]); // createHlsPlayerFn is passed as an argument, not a dependency

  const createHlsPlayer = useCallback((urlToLoad: string) => {
    const video = videoRef.current;
    if (!video) {
      setIsInitializing(false);
      return;
    }
    if (!Hls.isSupported()) {
      toast.error("HLS non supporté");
      setIsInitializing(false);
      return;
    }

    video.src = '';
    
    console.log('🎬 Creating HLS player with PRO config...');

    const hls = new Hls({
      debug: hlsDebugMode.current,
      enableWorker: true,
      lowLatencyMode: false,
      
      maxBufferLength: 120,
      maxMaxBufferLength: 180,
      maxBufferSize: 150 * 1000 * 1000,
      maxBufferHole: 0.3,
      backBufferLength: 10,
      
      liveSyncDurationCount: 4,
      liveMaxLatencyDurationCount: 10,
      liveDurationInfinity: false,
      maxLiveSyncPlaybackRate: 1.05,
      
      abrEwmaFastLive: 3.0,
      abrEwmaSlowLive: 12.0,
      abrEwmaDefaultEstimate: 1000000,
      
      abrBandWidthFactor: 0.85,
      abrBandWidthUpFactor: 0.65,
      abrMaxWithRealBitrate: true,
      minAutoBitrate: 0,
      
      startLevel: -1,
      testBandwidth: true,
      
      manifestLoadingTimeOut: 12000,
      manifestLoadingMaxRetry: 6,
      manifestLoadingRetryDelay: 500,
      manifestLoadingMaxRetryTimeout: 90000,
      
      levelLoadingTimeOut: 10000,
      levelLoadingMaxRetry: 6,
      levelLoadingRetryDelay: 500,
      levelLoadingMaxRetryTimeout: 90000,
      
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 10,
      fragLoadingRetryDelay: 300,
      fragLoadingMaxRetryTimeout: 90000,
      
      maxStarvationDelay: 10,
      maxLoadingDelay: 10,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.05,
      nudgeMaxRetry: 5,
      
      progressive: true,
      forceKeyFrameOnDiscontinuity: true,
      
      maxFragLookUpTolerance: 0.2,
      
      autoStartLoad: true,
      startPosition: -1
    });
    
    if (hlsDebugMode.current) {
      hls.on(Hls.Events.LEVEL_SWITCHED, (e, d) => 
        console.debug('[HLS] LEVEL_SWITCHED', d.level)
      );
      hls.on(Hls.Events.BUFFER_APPENDED, (e, d) => 
        console.debug('[HLS] BUFFER_APPENDED', d.timeRanges)
      );
      hls.on(Hls.Events.FRAG_LOADED, (e, d) => 
        console.debug('[HLS] FRAG_LOADED', d.frag.sn)
      );
    }

    hls.on(Hls.Events.MANIFEST_LOADING, (event, data) => {
      if (!data.url.includes('supabase.co/functions/v1/stream-proxy')) {
        console.log(`[HLS Proxy Intercept] Proxifying MANIFEST URL: ${data.url}`);
        data.url = getProxiedUrl(data.url, 'stream');
      }
    });

    hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
      if (!data.frag.url.includes('supabase.co/functions/v1/stream-proxy')) {
        console.log(`[HLS Proxy Intercept] Proxifying FRAGMENT URL: ${data.frag.url}`);
        data.frag.url = getProxiedUrl(data.frag.url, 'stream');
      }
    });

    // Attacher les gestionnaires d'événements HLS AVANT de charger la source
    setupHlsEventHandlers(hls, urlToLoad, createHlsPlayer);

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log('✅ HLS Manifest parsed:', data.levels.length, 'levels');
      const qualities: StreamQuality[] = data.levels.map((level: any, index: number) => ({
        id: `level-${index}`,
        label: `${level.height}p`,
        bandwidth: level.bitrate,
        resolution: `${level.width}x${level.height}`,
        url: ''
      }));
      setAvailableQualities(qualities);
      
      if (autoPlay) {
        video.play().then(() => {
          console.log('✅ HLS playback started');
          retryCountRef.current = 0;
          fragErrorCountRef.current = 0;
          setErrorMessage(null);
          toast.success("✅ Lecture démarrée", {
            description: `HLS • ${networkSpeed}`,
            duration: 2000
          });
          setIsInitializing(false);
        }).catch(err => {
          if (err.name !== 'AbortError') {
            console.error('❌ Play failed:', err);
            toast.error("Échec de lecture", {
              description: "Le flux n'a pas pu démarrer automatiquement.",
              duration: 3000
            });
          }
          setIsInitializing(false);
        });
      } else {
        setIsInitializing(false);
      }
    });
    
    hls.on(Hls.Events.FRAG_LOADED, () => {
      fragErrorCountRef.current = 0;
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
      setCurrentLevel(data.level);
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (hlsDebugMode.current) {
        console.debug('[HLS ERROR]', data.type, data.details, 'Fatal:', data.fatal);
      }
      
      if (!data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
            console.log('🔧 Buffer stalled (non-fatal), auto-recovering...');
            setTimeout(() => {
              if (videoRef.current && hlsRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
              }
            }, 1000);
          }
          
          if (data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
            console.log('🔧 Buffer hole detected, nudging...');
            setTimeout(() => {
              if (videoRef.current && hlsRef.current) {
                const currentTime = videoRef.current.currentTime;
                videoRef.current.currentTime = currentTime + 0.1;
                videoRef.current.play().catch(() => {});
              }
            }, 500);
          }
          
          if (data.details === Hls.ErrorDetails.BUFFER_APPEND_ERROR) {
            console.log('🔧 Buffer append error (non-fatal), continuing...');
          }
        }
        
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.log('🔧 Media error (non-fatal):', data.details);
        }
        
        return;
      }

      console.error('🔴 HLS Fatal Error:', data.type, data.details);

      if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || 
          data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR) {
        
        fragErrorCountRef.current++;
        
        if (fragErrorCountRef.current <= 8) {
          const delay = 300 * Math.pow(1.8, fragErrorCountRef.current - 1);
          console.log(`🔄 Retry fragment ${fragErrorCountRef.current}/8 in ${Math.round(delay)}ms`);
          
          setTimeout(() => {
            if (hlsRef.current) {
              try {
                const currentTime = video.currentTime || 0;
                hls.startLoad(currentTime);
              } catch (e) {
                console.error('startLoad failed:', e);
              }
            }
          }, delay);
          return;
        }
        
        if (fragErrorCountRef.current === 9 && hls.currentLevel > 0) {
          console.log('🔽 Too many frag errors, forcing lower quality...');
          hls.currentLevel = Math.max(0, hls.currentLevel - 1);
          fragErrorCountRef.current = 0;
          setTimeout(() => {
            if (hlsRef.current) hlsRef.current.startLoad();
          }, 500);
          return;
        }
        
        console.error('💥 Fragment errors exhausted, recreating player...');
        cleanup();
        scheduleRetry(() => createHlsPlayer(urlToLoad));
        return;
      }

      if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
          data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
          data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
        
        console.log('🔄 Manifest error, retrying...');
        cleanup();
        scheduleRetry(() => createHlsPlayer(urlToLoad));
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        console.log('🔄 Media error, attempting recovery...');
        
        if (fragErrorCountRef.current === 0) {
          fragErrorCountRef.current++;
          try {
            console.log('🔧 Trying hls.recoverMediaError()...');
            hls.recoverMediaError();
            
            setTimeout(() => {
              if (hlsRef.current && videoRef.current && !videoRef.current.paused) {
                fragErrorCountRef.current = 0;
                console.log('✅ Media recovery successful');
              }
            }, 5000);
            return;
          } catch (e) {
            console.error('recoverMediaError() failed:', e);
          }
        }
        
        if (fragErrorCountRef.current === 1) {
          fragErrorCountRef.current++;
          try {
            console.log('🔧 Trying hls.swapAudioCodec()...');
            hls.swapAudioCodec();
            hls.recoverMediaError();
            
            setTimeout(() => {
              if (hlsRef.current && videoRef.current && !videoRef.current.paused) {
                fragErrorCountRef.current = 0;
                console.log('✅ Codec swap successful');
              }
            }, 5000);
            return;
          } catch (e) {
            console.error('swapAudioCodec() failed:', e);
          }
        }
        
        console.error('💥 Media recovery exhausted, recreating player...');
        cleanup();
        scheduleRetry(() => createHlsPlayer(urlToLoad));
        return;
      }

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        console.log('🔄 Fatal network error, attempting startLoad...');
        
        if (fragErrorCountRef.current < 3) {
          fragErrorCountRef.current++;
          setTimeout(() => {
            if (hlsRef.current) {
              try {
                const currentTime = video.currentTime || 0;
                hls.startLoad(currentTime);
              } catch (e) {
                console.error('startLoad failed, recreating...');
                cleanup();
                scheduleRetry(() => createHlsPlayer(urlToLoad));
              }
            }
          }, 1000);
          return;
        }
        
        cleanup();
        scheduleRetry(() => createHlsPlayer(urlToLoad));
        return;
      }

      console.error('💥 Unhandled fatal error, recreating player...');
      cleanup();
      scheduleRetry(() => createHlsPlayer(urlToLoad));
    });
    
    hls.on(Hls.Events.BUFFER_APPENDING, (event, data) => {
      if (hlsDebugMode.current) {
        console.debug('[HLS] BUFFER_APPENDING', data);
      }
    });

    hls.on(Hls.Events.BUFFER_APPENDING, () => {
      setIsLoading(false);
    });

    hls.on(Hls.Events.BUFFER_APPENDED, () => {
      setIsLoading(false);
    });
    
    const liveEdgeIntervalRef = { current: null as NodeJS.Timeout | null };
    
    if (urlToLoad.includes('m3u8')) {
      liveEdgeIntervalRef.current = setInterval(() => {
        if (!video || !hls || video.paused) return;
        
        const liveSyncPosition = hls.liveSyncPosition;
        if (liveSyncPosition !== null && liveSyncPosition > 0) {
          const currentTime = video.currentTime;
          const latency = liveSyncPosition - currentTime;
          
          if (latency > 60) {
            console.warn(`⏩ Live latency too high (${latency.toFixed(1)}s), catching up...`);
            
            const targetRate = Math.min(1.15, 1 + (latency / 120));
            if (video.playbackRate !== targetRate) {
              video.playbackRate = targetRate;
              console.log(`🚀 Playback rate: ${targetRate.toFixed(2)}x`);
            }
            
            if (latency < 30 && video.playbackRate !== 1.0) {
              video.playbackRate = 1.0;
              console.log('✅ Playback rate normalized');
            }
          }
          
          if (latency > 120) {
            console.error('🚨 Live edge critically behind, seeking directly...');
            video.currentTime = liveSyncPosition - 10;
            video.playbackRate = 1.0;
          }
          
          if (latency < 10 && latency > 0) {
            if (video.playbackRate !== 0.95) {
              video.playbackRate = 0.95;
              console.log('🐌 Too close to live edge, slowing down to 0.95x');
            }
          }
        }
      }, 5000);
      
      (hls as any)._liveEdgeInterval = liveEdgeIntervalRef.current;
    }
    
    const hlsMaintenanceInterval = setInterval(() => {
      if (!video || !hls) return;
      
      const uptimeMinutes = (Date.now() - uptimeStartRef.current) / 1000 / 60;
      
      if (uptimeMinutes > 15 && uptimeMinutes % 15 === 0) {
        console.log(`🔧 HLS Maintenance (uptime: ${uptimeMinutes.toFixed(1)}min)`);
        
        try {
          const quality = (video as any).getVideoPlaybackQuality?.();
          if (quality) {
            const dropRate = quality.droppedVideoFrames / (quality.totalVideoFrames || 1);
            
            if (dropRate > 0.08) {
              console.warn(`⚠️ HLS qualité dégradée (${(dropRate * 100).toFixed(1)}% drops), recoverMediaError...`);
              try {
                hls.recoverMediaError();
              } catch (e) {
                console.error('recoverMediaError failed:', e);
              }
            }
          }
          
          const bufferInfo = hls.media?.buffered;
          if (bufferInfo && bufferInfo.length > 0) {
            const totalBuffered = bufferInfo.end(bufferInfo.length - 1) - bufferInfo.start(0);
            
            if (totalBuffered > 180) {
              console.log(`🧹 HLS buffer trop grand (${totalBuffered.toFixed(1)}s), cleanup...`);
              const currentTime = video.currentTime;
              hls.stopLoad();
              hls.startLoad(Math.max(0, currentTime - 10));
            }
          }
          
          const lastLoadedTime = (hls as any)._lastManifestLoadTime || Date.now();
          const timeSinceLastLoad = Date.now() - lastLoadedTime;
          
          if (timeSinceLastLoad > 120000) {
            console.error('🚨 Manifest appears frozen, forcing reload...');
            const currentTime = video.currentTime;
            hls.stopLoad();
            hls.startLoad(currentTime);
          }
        } catch (e) {
          console.warn('HLS maintenance error:', e);
        }
      }
    }, 60 * 1000);
    
    hls.on(Hls.Events.MANIFEST_LOADED, () => {
      (hls as any)._lastManifestLoadTime = Date.now();
    });
    
    (hls as any)._maintenanceInterval = hlsMaintenanceInterval;
    memoryCleanupIntervalRef.current = hlsMaintenanceInterval;
    
    console.log('CRITICAL DEBUG: HLS will load original source, proxying handled by config.url:', urlToLoad, 'type:', typeof urlToLoad);
    if (typeof urlToLoad !== 'string' || !urlToLoad) {
      console.error('CRITICAL ERROR: HLS URL is NOT a string or is empty before hls.loadSource:', urlToLoad);
      setErrorMessage('Erreur interne critique: URL du flux HLS invalide ou vide.');
      setIsInitializing(false);
      return;
    }

    hls.loadSource(urlToLoad);
    hls.attachMedia(video);
    hlsRef.current = hls;
  }, [autoPlay, cleanup, scheduleRetry, networkSpeed, setIsInitializing, setupHlsEventHandlers]);

  const initPlayer = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    retryCountRef.current = 0;
    fragErrorCountRef.current = 0;
    
    setTimeout(() => {
      useProxyRef.current = false;
      playerTypeRef.current = detectStreamType(streamUrl);
      console.log(`🎯 Detected stream type: ${playerTypeRef.current}`);
      console.log(`DEBUG: initPlayer using streamUrl: ${streamUrl}, type: ${typeof streamUrl}`);
      
      const currentStreamUrl = String(streamUrl);
      if (typeof currentStreamUrl !== 'string' || !currentStreamUrl) {
        console.error('CRITICAL ERROR: Stream URL is invalid or empty in initPlayer:', currentStreamUrl);
        setErrorMessage('Erreur interne: URL du flux invalide ou vide.');
        setIsLoading(false);
        setIsInitializing(false);
        return;
      }

      if (playerTypeRef.current === 'hls') {
        createHlsPlayer(currentStreamUrl);
      } else {
        createMpegtsPlayer(currentStreamUrl);
      }
    }, 150);
  }, [streamUrl, createHlsPlayer, createMpegtsPlayer, setIsInitializing]);

  const swapStream = useCallback(async (newUrl: string) => {
    if (isTransitioningRef.current) {
      console.log('⏳ Swap already in progress, skipping...');
      return;
    }
    
    isTransitioningRef.current = true;
    setIsLoading(true);
    
    const video = videoRef.current;
    if (!video) {
      isTransitioningRef.current = false;
      return;
    }

    const oldHls = hlsRef.current;
    const newType = detectStreamType(newUrl);
    
    console.log(`🔄 Swapping stream to ${newType}: ${newUrl}`);

    try {
      if (newType === 'hls' && Hls.isSupported()) {
        const newHls = new Hls({
          debug: hlsDebugMode.current,
          enableWorker: true,
          maxBufferLength: 120,
          maxBufferSize: 150 * 1000 * 1000,
          maxBufferHole: 0.3,
          liveSyncDurationCount: 4,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 10,
          fragLoadingRetryDelay: 300,
          autoStartLoad: true,
          startPosition: -1,
        });

        newHls.on(Hls.Events.MANIFEST_LOADING, (event, data) => {
          if (!data.url.includes('supabase.co/functions/v1/stream-proxy')) {
            console.log(`[HLS Swap Proxy Intercept] Proxifying MANIFEST URL: ${data.url}`);
            data.url = getProxiedUrl(data.url, 'stream');
          }
        });

        newHls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          if (!data.frag.url.includes('supabase.co/functions/v1/stream-proxy')) {
            console.log(`[HLS Swap Proxy Intercept] Proxifying FRAGMENT URL: ${data.frag.url}`);
            data.frag.url = getProxiedUrl(data.frag.url, 'stream');
          }
        });

        try {
          await fetch(newUrl, { method: 'HEAD', mode: 'cors' });
        } catch (e) {
          console.warn('Manifest prefetch failed, continuing anyway');
        }

        setupHlsEventHandlers(newHls, newUrl, createHlsPlayer);

        const readyPromise = new Promise<void>((resolve, reject) => {
          const onFragLoaded = () => {
            cleanup();
            resolve();
          };
          const onError = (ev: any, data: any) => {
            if (data?.fatal) {
              cleanup();
              reject(data);
            }
          };
          const cleanupListeners = () => {
            newHls.off(Hls.Events.FRAG_LOADED, onFragLoaded);
            newHls.off(Hls.Events.ERROR, onError);
          };
          
          newHls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
          newHls.on(Hls.Events.ERROR, onError);
          
          setTimeout(() => {
            cleanupListeners();
            resolve();
          }, 5000);
        });

        console.log('CRITICAL DEBUG: HLS Swap Player will load original source, proxying handled by config.url:', newUrl, 'type:', typeof newUrl);
        if (typeof newUrl !== 'string' || !newUrl) {
          console.error('CRITICAL ERROR: HLS Swap URL is not a string or is empty:', newUrl);
          setErrorMessage('Erreur interne critique: URL du flux HLS invalide lors du swap.');
          isTransitioningRef.current = false;
          setIsInitializing(false);
          return;
        }

        newHls.loadSource(newUrl);
        newHls.attachMedia(video);
        
        await readyPromise;

        if (oldHls) {
          try {
            oldHls.stopLoad();
            oldHls.detachMedia();
            oldHls.destroy();
          } catch (e) {
            console.warn('Old HLS cleanup warning:', e);
          }
        }

        hlsRef.current = newHls;
        playerTypeRef.current = 'hls';
        
        video.play().catch(() => {});
        
      } else {
        cleanup();
        setTimeout(() => {
          playerTypeRef.current = newType;
          if (newType === 'hls') {
            createHlsPlayer(newUrl);
          } else {
            createMpegtsPlayer(newUrl);
          }
        }, 200);
      }

    } catch (error) {
      console.error('Swap stream error:', error);
      cleanup();
      setTimeout(() => initPlayer(), 300);
    } finally {
      isTransitioningRef.current = false;
      fragErrorCountRef.current = 0;
      retryCountRef.current = 0;
    }
  }, [cleanup, createHlsPlayer, createMpegtsPlayer, setupHlsEventHandlers, initPlayer, setIsInitializing]);

  const playVastAd = useCallback(async () => {
    if (!vastUrl) {
      console.log('[VAST] No VAST URL provided, skipping ad and proceeding to content.');
      initPlayer();
      return;
    }

    const adVideo = adVideoRef.current;
    if (!adVideo) {
      console.warn('[VAST] Ad video element not available, falling back to main player.');
      initPlayer();
      return;
    }

    setIsLoading(true);
    setAdPlaying(true);
    console.log('🎬 [VAST] Loading ad...', { iOS: isIOS(), Safari: isSafari() });
    console.log('DEBUG: VAST URL:', vastUrl);

    try {
      const vastClient = new VASTClient();
      
      const proxiedVastUrl = getProxiedUrl(String(vastUrl), 'vast');
      console.log('DEBUG: Proxied VAST URL:', proxiedVastUrl);

      const response = await vastClient.get(proxiedVastUrl);
      const ad = response.ads[0];
      
      if (!ad || !ad.creatives || ad.creatives.length === 0) {
        console.warn('[VAST] No ad found, proceeding to content');
        setAdPlaying(false);
        setIsLoading(false);
        initPlayer();
        return;
      }

      const creative = ad.creatives.find((c: any) => c.type === 'linear');
      if (!creative || !creative.mediaFiles || creative.mediaFiles.length === 0) {
        console.warn('[VAST] No linear creative, proceeding to content');
        setAdPlaying(false);
        setIsLoading(false);
        initPlayer();
        return;
      }

      const mediaFile = creative.mediaFiles.find((mf: any) => 
        mf.mimeType?.includes('mp4')
      ) || creative.mediaFiles[0];
      
      if (!mediaFile || !mediaFile.fileURL) {
        console.warn('[VAST] No suitable media file found, proceeding to content');
        setAdPlaying(false);
        setIsLoading(false);
        initPlayer();
        return;
      }

      const adMediaUrl = String(mediaFile.fileURL);
      console.log('[VAST] Selected media:', { 
        url: adMediaUrl, 
        type: mediaFile.mimeType 
      });

      if (!adMediaUrl.startsWith('http://') && !adMediaUrl.startsWith('https://')) {
        console.error(`CRITICAL VAST ERROR: Ad media URL is relative: ${adMediaUrl}. This might cause issues.`);
      }

      const isIOSDevice = isIOS();
      const needsMuted = isIOSDevice && !userInteractedRef.current;
      
      adVideo.src = adMediaUrl;
      adVideo.load();
      
      if (needsMuted) {
        console.log('[VAST] iOS detected without user interaction - forcing muted');
        adVideo.muted = true;
        adVideo.volume = 0;
        toast.info("Publicité en sourdine", {
          description: "iOS bloque l'autoplay avec le son. Cliquez pour activer le son.",
          duration: 5000
        });
      } else {
        adVideo.muted = isMuted;
        adVideo.volume = isMuted ? 0 : volume;
      }

      const adDuration = creative.duration || 0;
      const skipDelay = creative.skipDelay || 5;
      
      setAdTimeRemaining(Math.ceil(adDuration));
      setAdSkippable(false);

      if (adCountdownIntervalRef.current) {
        clearInterval(adCountdownIntervalRef.current);
        adCountdownIntervalRef.current = null;
      }

      const startTime = Date.now();
      adCountdownIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.ceil(adDuration - elapsed);
        setAdTimeRemaining(Math.max(0, remaining));
        
        if (elapsed >= skipDelay) {
          setAdSkippable(true);
        }
        if (remaining <= 0) {
          if (adCountdownIntervalRef.current) {
            clearInterval(adCountdownIntervalRef.current);
            adCountdownIntervalRef.current = null;
          }
        }
      }, 100);

      const handleAdEnded = () => {
        console.log('[VAST] ✅ Ad completed normally');
        cleanupAdListeners();
        setAdPlaying(false);
        setIsLoading(false);
        initPlayer();
      };

      const handleAdError = (e: Event) => {
        console.warn('[VAST] ⚠️ Ad playback error, skipping to content', e);
        if (e.target instanceof HTMLVideoElement && e.target.error) {
          console.error('Ad error details:', e.target.error);
        }
        cleanupAdListeners();
        setAdPlaying(false);
        setIsLoading(false);
        initPlayer();
      };
      
      const handleAdCanPlay = async () => {
        console.log('[VAST] Ad ready to play, attempting playback...');
        setIsLoading(false);
        try {
          const playPromise = adVideo.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            console.log('[VAST] ✅ Ad playback started successfully');
            
            if (ad.impressionURLTemplates) {
              ad.impressionURLTemplates.forEach((trackingEvent: any) => {
                const trackingUrl = trackingEvent.url;
                if (typeof trackingUrl === 'string' && (trackingUrl.startsWith('http://') || trackingUrl.startsWith('https://'))) {
                  const proxiedTrackingUrl = getProxiedUrl(trackingUrl, 'vast-tracking');
                  fetch(proxiedTrackingUrl).catch((e) => console.warn('[VAST] Failed to track impression:', e));
                } else {
                  console.warn(`Skipping invalid VAST impression tracking URL: ${trackingUrl} (type: ${typeof trackingUrl})`);
                }
              });
            }
          }
        } catch (playError: any) {
          console.error('[VAST] Play failed after canplay:', playError);
          
          if (isIOSDevice && playError.name === 'NotAllowedError') {
            console.log('[VAST] iOS autoplay blocked - showing tap-to-play overlay');
            toast.info("Appuyez pour lancer la pub", {
              description: "iOS nécessite une interaction utilisateur pour l'autoplay avec son.",
              duration: 5000
            });
          }
          
          cleanupAdListeners();
          setAdPlaying(false);
          setIsLoading(false);
          initPlayer();
        }
      };

      const cleanupAdListeners = () => {
        adVideo.removeEventListener('ended', handleAdEnded);
        adVideo.removeEventListener('error', handleAdError);
        adVideo.removeEventListener('canplay', handleAdCanPlay);
        if (adCountdownIntervalRef.current) {
          clearInterval(adCountdownIntervalRef.current);
          adCountdownIntervalRef.current = null;
        }
      };

      adVideo.addEventListener('ended', handleAdEnded, { once: true });
      adVideo.addEventListener('error', handleAdError, { once: true });
      adVideo.addEventListener('canplay', handleAdCanPlay, { once: true });
      
      if (adVideo.readyState >= 3) {
        handleAdCanPlay();
      }

    } catch (error) {
      console.error('[VAST] Fatal error during ad loading/parsing:', error);
      setAdPlaying(false);
      setIsLoading(false);
      initPlayer();
    }
  }, [initPlayer, volume, isMuted, vastUrl, cleanup, setIsInitializing]);

  const skipAd = useCallback(() => {
    if (!adSkippable) return;
    
    const adVideo = adVideoRef.current;
    if (adVideo) {
      adVideo.pause();
      adVideo.src = '';
      adVideo.load();
    }
    
    if (adCountdownIntervalRef.current) {
      clearInterval(adCountdownIntervalRef.current);
      adCountdownIntervalRef.current = null;
    }
    
    setAdPlaying(false);
    initPlayer();
  }, [adSkippable, initPlayer]);

  useEffect(() => {
    if (!videoRef.current) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(0) - video.currentTime;
        const health = Math.min(100, Math.round(buffered / 10 * 100));
        setBufferHealth(health);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: Event) => {
      console.error('❌ Video element error:', e);
      setIsLoading(false);
    };
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current || !streamUrl) return;
    
    console.log(`[Player] useEffect triggered for streamUrl: ${streamUrl}`);
    
    setIsInitializing(true);

    uptimeStartRef.current = Date.now();
    lastMemoryCleanupRef.current = Date.now();
    playbackQualityCheckRef.current = 0;
    mpegtsStallRecoveryAttemptsRef.current = 0;
    
    cleanup();

    if (vastUrl) {
      playVastAd();
    } else {
      console.log('[Player] No VAST URL provided, directly initializing main player.');
      initPlayer();
    }
    
    return () => {
      console.log('[Player] Cleanup on stream change/unmount');
      cleanup();
      setIsInitializing(false);
    };
  }, [streamUrl, vastUrl, playVastAd, initPlayer, cleanup, setIsInitializing]);
  
  useEffect(() => {
    const markInteraction = () => {
      if (!userInteractedRef.current) {
        console.log('[Player] User interaction detected');
        userInteractedRef.current = true;
      }
    };
    
    document.addEventListener('click', markInteraction, { once: true });
    document.addEventListener('touchstart', markInteraction, { once: true });
    
    return () => {
      document.removeEventListener('click', markInteraction);
      document.removeEventListener('touchstart', markInteraction);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Play error:', err);
        }
      });
    }
  };
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };
  const handleMuteToggle = () => setIsMuted(!isMuted);
  
  const handleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    try {
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (isFullscreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      } else {
        if ((video as any).webkitEnterFullscreen) {
          (video as any).webkitEnterFullscreen();
        } else if ((video as any).webkitRequestFullscreen) {
          (video as any).webkitRequestFullscreen();
        } else if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          (container as any).msRequestFullscreen();
        }
        
        if (screen.orientation && (screen.orientation as any).lock) {
          (screen.orientation as any).lock('landscape').catch(() => {
            console.log('Orientation lock not supported');
          });
        }
      }
      
      toast.success(isFullscreen ? "Mode normal" : "Mode plein écran");
    } catch (error) {
      console.warn('Fullscreen error:', error);
      toast.error("Mode plein écran non disponible");
    }
  };
  const handlePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
        toast.success("📺 Picture-in-Picture activé");
      }
    } catch (err) {
      toast.error("Picture-in-Picture non disponible");
    }
  };
  const handleQualityChange = useCallback((newQuality: string) => {
    setQuality(newQuality);
    
    if (playerTypeRef.current === 'hls' && hlsRef.current) {
      if (newQuality === 'auto') {
        hlsRef.current.currentLevel = -1;
        toast.success('⚡ Qualité automatique', {
          description: 'Adaptation au débit réseau'
        });
      } else {
        const qualityMap: { [key: string]: number } = {
          'low': 0,
          'medium': Math.floor(availableQualities.length / 2),
          'high': availableQualities.length - 1
        };
        const targetLevel = qualityMap[newQuality] || -1;
        if (targetLevel >= 0 && targetLevel < availableQualities.length) {
          hlsRef.current.currentLevel = targetLevel;
          const quality = availableQualities[targetLevel];
          toast.success(`Qualité: ${quality?.label}`, {
            description: `${(quality?.bandwidth / 1000000).toFixed(1)} Mbps`
          });
        }
      }
    } else if (playerTypeRef.current === 'mpegts' && mpegtsRef.current) {
      const video = videoRef.current;
      if (!video) return;
      
      try {
        const player = mpegtsRef.current;
        const currentTime = video.currentTime;
        const wasPlaying = !video.paused;
        
        player.pause();
        player.unload();
        
        let config = {
          type: 'mpegts',
          isLive: true,
          url: useProxyRef.current ? getProxiedUrl(streamUrl, 'stream') : streamUrl,
          cors: true,
          withCredentials: false
        };
        
        let options: any = {
          enableWorker: true,
          enableStashBuffer: true,
          autoCleanupSourceBuffer: true,
          liveBufferLatencyChasing: false,
          fixAudioTimestampGap: true,
          lazyLoad: false,
          deferLoadAfterSourceOpen: false,
          accurateSeek: false,
          seekType: 'range',
          isLive: true,
          reuseRedirectedURL: true
        };
        
        if (newQuality === 'low') {
          options.stashInitialSize = 2 * 1024 * 1024;
          options.autoCleanupMaxBackwardDuration = 40;
          options.autoCleanupMinBackwardDuration = 20;
          options.liveBufferLatencyMaxLatency = 10;
          options.liveBufferLatencyMinRemain = 4;
          toast.success('💾 Qualité basse', {
            description: 'Stabilité maximale, latence réduite'
          });
        } else if (newQuality === 'medium') {
          options.stashInitialSize = 3 * 1024 * 1024;
          options.autoCleanupMaxBackwardDuration = 50;
          options.autoCleanupMinBackwardDuration = 25;
          options.liveBufferLatencyMaxLatency = 12;
          options.liveBufferLatencyMinRemain = 5;
          toast.success('📺 Qualité moyenne', {
            description: 'Équilibre stabilité/qualité'
          });
        } else if (newQuality === 'high') {
          options.stashInitialSize = 5 * 1024 * 1024;
          options.autoCleanupMaxBackwardDuration = 70;
          options.autoCleanupMinBackwardDuration = 35;
          options.liveBufferLatencyMaxLatency = 18;
          options.liveBufferLatencyMinRemain = 7;
          toast.success('🎯 Qualité haute', {
            description: 'Meilleure qualité, buffers augmentés'
          });
        } else {
          const speed = getNetworkSpeed();
          if (speed === 'fast') {
            options.stashInitialSize = 4 * 1024 * 1024;
            options.autoCleanupMaxBackwardDuration = 60;
            options.autoCleanupMinBackwardDuration = 30;
            options.liveBufferLatencyMaxLatency = 15;
            options.liveBufferLatencyMinRemain = 6;
          } else if (speed === 'medium') {
            options.stashInitialSize = 3 * 1024 * 1024;
            options.autoCleanupMaxBackwardDuration = 50;
            options.autoCleanupMinBackwardDuration = 25;
            options.liveBufferLatencyMaxLatency = 12;
            options.liveBufferLatencyMinRemain = 5;
          } else {
            options.stashInitialSize = 2 * 1024 * 1024;
            options.autoCleanupMaxBackwardDuration = 40;
            options.autoCleanupMinBackwardDuration = 20;
            options.liveBufferLatencyMaxLatency = 10;
            options.liveBufferLatencyMinRemain = 4;
          }
          toast.success('⚡ Mode adaptatif', {
            description: `Optimisé pour ${speed === 'fast' ? '4G/5G' : speed === 'medium' ? '3G' : '2G'}`
          });
        }
        
        const newPlayer = mpegts.createPlayer(config, options);
        
        newPlayer.on(mpegts.Events.ERROR, (errorType: string, errorDetail: any) => {
          console.error('🔴 MPEGTS Error après changement qualité:', errorType, errorDetail);
          if (!useProxyRef.current && errorType === mpegts.ErrorTypes.NETWORK_ERROR) {
            useProxyRef.current = true;
            cleanup();
            scheduleRetry(() => createMpegtsPlayer(streamUrl));
          } else {
            if (errorType === mpegts.ErrorTypes.NETWORK_ERROR && errorDetail.code === 404) {
              setErrorMessage("Erreur 404 du proxy Supabase. Veuillez vérifier les logs de votre fonction Edge Function sur Supabase.");
              toast.error("Proxy Supabase introuvable", {
                description: "Vérifiez le déploiement et les logs de votre fonction Edge Function.",
                duration: 8000
              });
            }
            cleanup();
            scheduleRetry(() => createMpegtsPlayer(streamUrl));
          }
        });
        
        newPlayer.attachMediaElement(video);
        newPlayer.load();
        
        if (currentTime > 0) {
          video.currentTime = currentTime;
        }
        if (wasPlaying) {
          setTimeout(() => {
            video.play().catch(() => {});
          }, 200);
        }
        
        mpegtsRef.current = newPlayer;
        
      } catch (error) {
        console.error('Erreur changement qualité MPEG-TS:', error);
        toast.error('Erreur changement qualité', {
          description: 'Le flux va être rechargé'
        });
        cleanup();
        setTimeout(() => createMpegtsPlayer(streamUrl), 500);
      }
    }
  }, [availableQualities, streamUrl, cleanup, scheduleRetry, createMpegtsPlayer, networkSpeed]);

  const handleVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || adPlaying) return;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const side = clickX < rect.width / 2 ? 'left' : 'right';
    if (now - lastTapTimeRef.current < 300 && lastTapSideRef.current === side) {
      const seekAmount = side === 'left' ? -10 : 10;
      video.currentTime = Math.max(0, video.currentTime + seekAmount);
      setShowSeekFeedback({
        direction: side === 'left' ? 'backward' : 'forward',
        show: true
      });
      toast.info(side === 'left' ? '⏪ -10s' : '⏩ +10s', {
        duration: 1000
      });
      setTimeout(() => setShowSeekFeedback({
        direction: 'forward',
        show: false
      }), 500);
      lastTapTimeRef.current = 0;
      lastTapSideRef.current = null;
    } else {
      lastTapTimeRef.current = now;
      lastTapSideRef.current = side;
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || adPlaying) return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'KeyF':
          handleFullscreen();
          break;
        case 'KeyM':
          handleMuteToggle();
          break;
        case 'KeyP':
          handlePiP();
          break;
        case 'KeyS':
          setShowStats(s => !s);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = video.currentTime + 10;
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [adPlaying, handlePlayPause, handleFullscreen, handleMuteToggle, handlePiP]);
  
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettings && !adPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };
  const currentQualityLabel = playerTypeRef.current === 'hls' && currentLevel >= 0 ? availableQualities[currentLevel]?.label || 'Auto' : 'Live';
  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-2xl" onMouseMove={handleMouseMove} onMouseLeave={() => isPlaying && !showSettings && !adPlaying && setShowControls(false)} onClick={handleVideoClick}>
      <video 
        ref={adVideoRef}
        className={`absolute inset-0 w-full h-full object-contain bg-black z-50 ${adPlaying ? 'block' : 'hidden'}`}
        playsInline
        preload="auto"
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        x5-playsinline="true"
        x5-video-player-type="h5"
        x5-video-player-fullscreen="true"
        style={{
          width: '100%',
          height: '100%'
        }}
      />

      <video 
        ref={videoRef} 
        className={`absolute inset-0 w-full h-full ${adPlaying ? 'hidden' : 'block'}`}
        playsInline 
        preload="auto"
        webkit-playsinline="true"
        x-webkit-airplay="allow"
        controlsList="nodownload"
      />

      {adPlaying && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-black/80 backdrop-blur-sm px-2 py-1 md:px-3 md:py-1.5 rounded-md">
            <p className="text-white text-xs md:text-sm font-medium">Publicité</p>
          </div>
          
          <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-black/80 backdrop-blur-sm px-2 py-1 md:px-3 md:py-1.5 rounded-md">
            <p className="text-white text-xs md:text-sm tabular-nums">{adTimeRemaining}s</p>
          </div>
          
          {adSkippable && (
            <div className="absolute bottom-16 md:bottom-20 right-2 md:right-4 pointer-events-auto">
              <button
                onClick={skipAd}
                className="bg-white/95 hover:bg-white active:scale-95 text-black font-semibold px-3 py-2 md:px-4 md:py-2.5 rounded-md transition-all shadow-lg text-sm md:text-base touch-manipulation"
                style={{ minHeight: '44px', minWidth: '120px' }}
              >
                Passer la pub →
              </button>
            </div>
          )}
        </div>
      )}

      {!isLoading && !errorMessage && videoMetrics.resolution !== 'N/A' && !adPlaying && (
        <QualityIndicator 
          resolution={videoMetrics.resolution} 
          bitrate={videoMetrics.actualBitrate} 
          bufferHealth={bufferHealth} 
        />
      )}

      <PlayerStats videoElement={videoRef.current} playerType={playerTypeRef.current} useProxy={useProxyRef.current} bufferHealth={bufferHealth} isVisible={showStats && !adPlaying} networkSpeed={networkSpeed} bandwidthMbps={realBandwidth.currentBitrate || 0} bandwidthTrend="stable" realBitrate={realBandwidth.currentBitrate} healthStatus={healthStatus} abrState={{
      currentQuality: currentLevel >= 0 ? availableQualities[currentLevel] : null,
      targetQuality: null,
      isAdapting: false,
      adaptationReason: `${playerTypeRef.current} native`
    }} />

      <PlayerSettings playbackRate={playbackRate} onPlaybackRateChange={setPlaybackRate} quality={quality} onQualityChange={handleQualityChange} isVisible={showSettings && !adPlaying} onClose={() => setShowSettings(false)} availableQualities={availableQualities} />

      {showSeekFeedback.show && !adPlaying && <div className={`absolute top-1/2 ${showSeekFeedback.direction === 'backward' ? 'left-8' : 'right-8'} -translate-y-1/2 animate-in fade-in zoom-in duration-200`}>
          <div className="bg-black/80 backdrop-blur-xl rounded-full p-4">
            <span className="text-4xl">{showSeekFeedback.direction === 'backward' ? '⏪' : '⏩'}</span>
          </div>
        </div>}

      {isLoading && !errorMessage && !adPlaying && <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-white" />
            <p className="text-white font-medium">Chargement du flux...</p>
            {retryCountRef.current > 0 && <p className="text-white/70 text-sm">Tentative {retryCountRef.current}/5</p>}
          </div>
        </div>}

      {errorMessage && !adPlaying && <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-40">
          <div className="flex flex-col items-center gap-4 max-w-md px-6">
            <div className="text-red-500 text-6xl">⚠️</div>
            <p className="text-white font-bold text-xl text-center">{errorMessage}</p>
            <Button onClick={() => {
          retryCountRef.current = 0;
          initPlayer();
        }} className="bg-primary hover:bg-primary/90">
              Réessayer
            </Button>
          </div>
        </div>}

      {showControls && !errorMessage && !adPlaying && <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 z-30">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePlayPause} className="text-white hover:bg-white/20">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={handleMuteToggle} className="text-white hover:bg-white/20">
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>

            <Slider value={[isMuted ? 0 : volume]} onValueChange={handleVolumeChange} max={1} step={0.1} className="w-24" />

            <div className="flex-1" />

            <Button variant="ghost" size="icon" onClick={() => setShowStats(!showStats)} className="text-white hover:bg-white/20">
              <BarChart3 className="w-5 h-5" />
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className="text-white hover:bg-white/20">
              <SettingsIcon className="w-5 h-5" />
            </Button>

            <Button variant="ghost" size="icon" onClick={handlePiP} className="text-white hover:bg-white/20">
              <PictureInPicture className="w-5 h-5" />
            </Button>

            <Button variant="ghost" size="icon" onClick={handleFullscreen} className="text-white hover:bg-white/20">
              <Maximize className="w-5 h-5" />
            </Button>
          </div>
        </div>}
    </div>
  );
};