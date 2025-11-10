// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Expose-Headers': 'content-length, content-type, content-range, accept-ranges',
};

// ========== CACHE & KEEPALIVE ==========
const manifestCache = new Map<string, { content: string; timestamp: number }>();
const MANIFEST_CACHE_TTL = 4000; // 4s pour manifests live

function buildIPTVHeaders(streamUrl: string): Record<string, string> {
  const urlObj = new URL(streamUrl);
  const fakeIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  
  return {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
    'Accept': '*/*',
    'Connection': 'keep-alive',
    'X-Forwarded-For': fakeIP,
    'Origin': urlObj.origin,
    'Referer': `${urlObj.origin}/`,
  };
}

function buildGenericBrowserHeaders(originalRequestHeaders: Headers, streamUrl: string): Record<string, string> {
    const urlObj = new URL(streamUrl);
    return {
      'User-Agent': originalRequestHeaders.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
      'Accept': originalRequestHeaders.get('Accept') || '*/*',
      'Accept-Language': originalRequestHeaders.get('Accept-Language') || 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Origin': originalRequestHeaders.get('Origin') || urlObj.origin,
      'Referer': originalRequestHeaders.get('Referer') || `${urlObj.origin}/`,
    };
}

async function proxyAndOptimizeM3U8(content: string, baseUrl: string, proxyBaseUrl: string): Promise<string> {
  const lines = content.split('\n');
  const proxiedLines: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const absoluteUrl = new URL(trimmedLine, baseUrl).toString();
      proxiedLines.push(`${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}&type=stream`);
    } else {
      proxiedLines.push(line);
    }
  }
  return proxiedLines.join('\n');
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutMs = 12000 + (attempt * 3000); // 12s, 15s, 18s
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      console.log(`[Proxy Fetch] Attempt ${attempt + 1}/${maxRetries} for ${url} with timeout ${timeoutMs}ms`);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`[Proxy Fetch] ✅ Success on attempt ${attempt + 1}`);
        return response;
      }
      
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Proxy Fetch] ⚠️ Attempt ${attempt + 1} failed: ${(error as Error).message}`);
      if (attempt < maxRetries - 1) {
        const delayMs = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
        console.log(`[Proxy Fetch] 🔄 Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');
    
    if (!streamUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let response: Response | null = null;
    let lastError: Error | null = null;

    const strategies = [
      // Strategy 1: Specific IPTV headers
      () => fetchWithRetry(streamUrl, { headers: buildIPTVHeaders(streamUrl), redirect: 'follow' }),
      // Strategy 2: VLC-like headers
      () => fetchWithRetry(streamUrl, { headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' }, redirect: 'follow' }, 2),
      // Strategy 3: Generic browser headers
      () => fetchWithRetry(streamUrl, { headers: buildGenericBrowserHeaders(req.headers, streamUrl), redirect: 'follow' }, 1),
    ];

    for (const strategy of strategies) {
      try {
        response = await strategy();
        if (response.ok) break;
      } catch (error) {
        lastError = error as Error;
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error(`Stream inaccessible with status: ${response?.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('mpegurl') || streamUrl.includes('.m3u8')) {
      const cached = manifestCache.get(streamUrl);
      if (cached && (Date.now() - cached.timestamp) < MANIFEST_CACHE_TTL) {
        return new Response(cached.content, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/vnd.apple.mpegurl', 'X-Cache': 'HIT' } });
      }
      
      const playlistContent = await response.text();
      const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
      const proxyBaseUrl = `${url.origin}${url.pathname}`;
      const optimizedPlaylist = await proxyAndOptimizeM3U8(playlistContent, baseUrl, proxyBaseUrl);
      
      manifestCache.set(streamUrl, { content: optimizedPlaylist, timestamp: Date.now() });
      if (manifestCache.size > 100) {
        const firstKey = manifestCache.keys().next().value;
        if (firstKey) {
          manifestCache.delete(firstKey);
        }
      }
      
      return new Response(optimizedPlaylist, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/vnd.apple.mpegurl', 'X-Cache': 'MISS' } });
    }

    const responseHeaders = new Headers(corsHeaders);
    ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach(h => {
      if (response.headers.has(h)) responseHeaders.set(h, response.headers.get(h)!);
    });
    if (streamUrl.includes('.ts') || streamUrl.includes('.m4s')) {
      responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return new Response(response.body, { status: response.status, headers: responseHeaders });

  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('[Proxy] 💥 Final Proxy error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});