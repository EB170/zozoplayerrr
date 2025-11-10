import { supabaseConfig } from '@/config/supabase';

export type PlayerType = 'mpegts' | 'hls';

export const getProxiedUrl = (originalUrl: string, type: 'stream' | 'vast' | 'vast-tracking' = 'stream'): string => {
  const proxyUrl = `https://${supabaseConfig.projectId}.supabase.co/functions/v1/stream-proxy`;
  const finalUrl = `${proxyUrl}?url=${encodeURIComponent(String(originalUrl))}&type=${type}`;
  return finalUrl;
};

export const detectStreamType = (url: string): PlayerType => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.m3u8') || urlLower.includes('m3u8')) {
    return 'hls';
  }
  if (urlLower.includes('.ts') || urlLower.includes('extension=ts')) {
    return 'mpegts';
  }
  // Default to mpegts as it was the previous behavior
  return 'mpegts';
};

export const getNetworkSpeed = (): 'fast' | 'medium' | 'slow' => {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType === '4g' || effectiveType === '5g') return 'fast';
    if (effectiveType === '3g') return 'medium';
    return 'slow';
  }
  // Default to fast if API is not available
  return 'fast';
};