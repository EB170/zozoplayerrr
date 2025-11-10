import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tv, Star, AlertTriangle } from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogoForChannel } from "@/config/logo-map";
import { StreamInput } from "@/components/StreamInput";
import VideoPlayerHybrid, { VideoPlayerRef } from "@/components/VideoPlayerHybrid";
import AdGateOverlay from "@/components/AdGateOverlay";

type Channel = Tables<'channels'>;

// The ChannelListContent component remains unchanged...
const ChannelListContent = ({ channels, selectedChannel, onChannelSelect, onToggleFavorite, favorites, isLoading, layout = 'sidebar' }: { channels: Channel[], selectedChannel: string, onChannelSelect: (channel: Channel) => void, onToggleFavorite: (channelName: string, e: React.MouseEvent) => void, favorites: string[], isLoading: boolean, layout?: 'sidebar' | 'inline' }) => {
  const isSidebar = layout === 'sidebar';

  const groupedChannels = useMemo(() => {
    return channels.reduce((acc, channel) => {
      const provider = channel.provider || 'Autres Chaînes';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(channel);
      return acc;
    }, {} as Record<string, Channel[]>);
  }, [channels]);

  const favoriteChannels = useMemo(() => channels.filter(c => favorites.includes(c.name)), [channels, favorites]);

  const ChannelListItem = ({ channel }: { channel: Channel }) => (
    <li
      onClick={() => onChannelSelect(channel)}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-primary/20",
        selectedChannel === channel.name ? "bg-primary/20" : "bg-transparent"
      )}
    >
      <div className="w-10 h-10 flex-shrink-0 rounded-md bg-white/5 flex items-center justify-center overflow-hidden">
        <img src={getLogoForChannel(channel.name)} alt={channel.name} className="max-w-[90%] max-h-[90%] object-contain" />
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-semibold text-foreground truncate">{channel.name}</p>
        <p className="text-xs text-muted-foreground">{channel.provider}</p>
      </div>
      {selectedChannel === channel.name && (
        <div className="flex items-center gap-1.5 text-red-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-xs font-bold">LIVE</span>
        </div>
      )}
      <button onClick={(e) => onToggleFavorite(channel.name, e)} className="p-1 opacity-50 hover:opacity-100">
        <Star className={cn("w-4 h-4 transition-colors", favorites.includes(channel.name) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
      </button>
    </li>
  );

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-6 w-1/2 mb-4 bg-white/10" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 p-2.5">
                <Skeleton className="w-10 h-10 rounded-md bg-white/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 bg-white/10" />
                  <Skeleton className="h-3 w-1/2 bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      "p-4 space-y-6",
      isSidebar ? "flex-1 overflow-y-auto custom-scrollbar" : ""
    )}>
      {favoriteChannels.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-yellow-400 mb-2 px-2.5 flex items-center gap-2"><Star className="w-4 h-4" /> Favoris</h3>
          <ul className="space-y-1">
            {favoriteChannels.map(channel => <ChannelListItem key={channel.id} channel={channel} />)}
          </ul>
        </section>
      )}
      {Object.entries(groupedChannels).map(([provider, channels]) => (
        <section key={provider}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2.5">{provider}</h3>
          <ul className="space-y-1">
            {channels.map(channel => <ChannelListItem key={channel.id} channel={channel} />)}
          </ul>
        </section>
      ))}
    </div>
  );
};


const Index = () => {
  const [streamUrl, setStreamUrl] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(true);
  const playerRef = useRef<VideoPlayerRef>(null);
  const queryClient = useQueryClient();

  const { data: channels = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('channels').select('*').eq('is_active', true).order('provider').order('name');
      if (error) throw new Error(error.message);
      return data;
    }
  });

  useEffect(() => {
    const storedFavorites = localStorage.getItem("favoriteChannels");
    if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
  }, []);

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setStreamUrl(channel.urls[0]);
    setIsLocked(true); // Verrouiller à chaque changement de chaîne
    toast.success(`📺 ${channel.name} prêt. Cliquez pour déverrouiller.`);
  };

  const handleCustomUrlSubmit = (url: string) => {
    setSelectedChannel(null);
    setStreamUrl(url);
    setIsLocked(true);
    toast.success(`📺 URL personnalisée prête. Cliquez pour déverrouiller.`);
  };

  const handleUnlock = useCallback(() => {
    setIsLocked(false);
    playerRef.current?.play();
  }, []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['channels'] });
    toast.info("Liste des chaînes rafraîchie !");
  };

  const toggleFavorite = (channelName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = favorites.includes(channelName) ? favorites.filter(name => name !== channelName) : [...favorites, channelName];
    setFavorites(newFavorites);
    localStorage.setItem("favoriteChannels", JSON.stringify(newFavorites));
    toast.success(favorites.includes(channelName) ? `${channelName} retiré des favoris` : `⭐ ${channelName} ajouté aux favoris !`);
  };

  const channelListProps = {
    channels,
    selectedChannel: selectedChannel?.name || "",
    onChannelSelect: handleChannelSelect,
    onToggleFavorite: toggleFavorite,
    favorites,
    isLoading,
  };

  return (
    <div className="h-screen w-screen bg-background flex flex-col">
      <header className="flex items-center justify-center py-3 px-4 md:px-0 border-b border-white/10 bg-card/30 backdrop-blur-xl z-10 flex-shrink-0">
        <img src="/logo.png" alt="ZozoPlayer" className="h-10" style={{ filter: 'drop-shadow(0 0 10px hsl(var(--primary) / 0.5))' }} />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex flex-col w-80 lg:w-96 bg-card/50 backdrop-blur-xl border-r border-white/10">
          <div className="p-4 border-b border-white/10">
            <StreamInput onUrlSubmit={handleCustomUrlSubmit} onRefresh={handleRefresh} />
          </div>
          <ChannelListContent {...channelListProps} />
        </aside>
        
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="w-full md:px-8 md:pt-8 flex-shrink-0">
            <div className="relative w-full aspect-video md:rounded-lg overflow-hidden shadow-glow bg-black">
              {isLocked && streamUrl && <AdGateOverlay onUnlock={handleUnlock} />}
              {streamUrl ? (
                <VideoPlayerHybrid ref={playerRef} streamUrl={streamUrl} autoPlay={!isLocked} />
              ) : (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center text-center p-8">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Tv className="w-8 h-8" />
                    <p className="text-xl font-semibold">Sélectionnez un flux pour commencer</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <main className="flex-1 p-4 md:p-8">
            <div className="md:hidden">
              <div className="mb-4">
                <StreamInput onUrlSubmit={handleCustomUrlSubmit} onRefresh={handleRefresh} />
              </div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Tv className="w-5 h-5 text-primary" />
                Chaînes Disponibles
              </h2>
              <Card className="bg-card/50">
                <ChannelListContent {...channelListProps} layout="inline" />
              </Card>
            </div>

            {isError && (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-destructive">Erreur de chargement</h3>
                <p className="text-muted-foreground mb-4">Impossible de récupérer la liste des chaînes.</p>
                <Button onClick={() => refetch()}>Réessayer</Button>
              </div>
            )}
          </main>
        </div>
      </div>
      <PWAInstallPrompt />
    </div>
  );
};

export default Index;