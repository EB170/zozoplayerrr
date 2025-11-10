import { useState, useEffect, useCallback, RefObject } from 'react';

export const usePlayerState = (videoRef: RefObject<HTMLVideoElement>) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isMutedByBrowser, setIsMutedByBrowser] = useState(false);

  // Sync video element events with state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => { setIsPlaying(true); setIsLoading(false); };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleCanPlay = () => setIsLoading(false);
    const handleVolumeChange = () => {
      if (video) {
        setVolume(video.volume);
        setIsMuted(video.muted);
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('volumechange', handleVolumeChange);

    // Initial state from video element
    setIsPlaying(!video.paused);
    setIsLoading(false);
    setVolume(video.volume);
    setIsMuted(video.muted);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [videoRef]);

  // Sync state back to video element properties
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = isMuted;
    }
  }, [videoRef, volume, isMuted]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(err => {
        if (err.name !== 'AbortError') console.error('Play error:', err);
      });
    } else {
      video.pause();
    }
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    setIsMuted(current => !current);
    setIsMutedByBrowser(false);
  }, []);
  
  const unmuteByBrowser = useCallback(() => {
    setIsMuted(false);
    setIsMutedByBrowser(false);
  }, []);

  return {
    isPlaying,
    isLoading,
    isMuted,
    isMutedByBrowser,
    setIsLoading,
    setIsMuted,
    setIsMutedByBrowser,
    togglePlayPause,
    toggleMute,
    unmuteByBrowser,
  };
};