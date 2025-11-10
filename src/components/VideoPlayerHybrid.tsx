"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { detectStreamType, getProxiedUrl } from '@/utils/player';
import { Loader2 } from 'lucide-react';

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
  const playerRef = useRef<Hls | mpegts.Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    const type = detectStreamType(streamUrl);
    const proxiedUrl = getProxiedUrl(streamUrl);

    // Cleanup previous instance
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    setIsLoading(true);

    if (type === 'hls' && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 60, // Buffer agressif
        maxMaxBufferLength: 120,
      });
      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) video.play();
      });
      hls.on(Hls.Events.FRAG_LOADED, () => setIsLoading(false));
      playerRef.current = hls;
    } else if (type === 'mpegts' && mpegts.isSupported()) {
      const mpegtsPlayer = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: proxiedUrl });
      mpegtsPlayer.attachMediaElement(video);
      mpegtsPlayer.load();
      mpegtsPlayer.on(mpegts.Events.MEDIA_INFO, () => {
        if (autoPlay) mpegtsPlayer.play();
        setIsLoading(false);
      });
      playerRef.current = mpegtsPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [streamUrl, autoPlay]);

  useImperativeHandle(ref, () => ({
    play: () => {
      videoRef.current?.play().catch(e => console.error("Play failed", e));
    },
    pause: () => {
      videoRef.current?.pause();
    },
  }));

  return (
    <div className="w-full h-full relative bg-black">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}
      <video ref={videoRef} className="w-full h-full" controls playsInline />
    </div>
  );
});

export default VideoPlayerHybrid;