import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tv, Loader2, Star, AlertTriangle } from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogoForChannel } from "@/config/logo-map";
import { StreamInput } from "@/components/StreamInput";
import VideoPlayerVAST from "@/components/VideoPlayerVAST"; // Nouveau lecteur
import { adStateManager } from "@/lib/adStateManager";

type Channel = Tables<'channels'>;

interface IndexProps {
  monetagRef: React.RefObject<{
    requestPushNotifications: () => void;
  }>;
}

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

const Index = ({ monetagRef }: IndexProps) => {
  const [streamUrl, setStreamUrl] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isChangingChannel, setIsChangingChannel] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
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

    // Détection d'Ad-Blocker au chargement de la page
    adStateManager.detectAdBlocker().then(detected => {
      if (detected && adStateManager.canShow('push_prompt')) {
        toast.info("Pour soutenir le site, pensez à activer les notifications !", {
          action: {
            label: "Activer",
            onClick: () => monetagRef.current?.requestPushNotifications(),
          },
        });
      }
    });
  }, [monetagRef]);

  const handleFirstInteraction = useCallback(() => {
    if (!userHasInteracted) setUserHasInteracted(true);
  }, [userHasInteracted]);

  const handleChannelSelect = (channel: Channel) => {
    if (selectedChannel?.name !== channel.name) {
      setIsChangingChannel(true);
      setTimeout(() => setIsChangingChannel(false), 1500);
    }
    setSelectedChannel(channel);
    setStreamUrl(channel.urls[0]);
    toast.success(`📺 Chargement de ${channel.name}`);
  };

  const handleCustomUrlSubmit = (url: string) => {
    setIsChangingChannel(true);
    setTimeout(() => setIsChangingChannel(false), 1500);
    setSelectedChannel(null);
    setStreamUrl(url);
    toast.success(`📺 Chargement de l'URL personnalisée`);
  };

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
    <div className="h-screen w-screen bg-background flex flex-col" onClick={handleFirstInteraction} onTouchStart={handleFirstInteraction}>
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
              {isChangingChannel && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="mt-4 text-white font-semibold">Chargement du flux...</p>
                </div>
              )}
              {streamUrl ? (
                <VideoPlayerVAST 
                  streamUrl={streamUrl} 
                  vastUrl="https://frail-benefit.com/dcmuFBz.daGiNHvGZXGuUf/Leym/9DuQZcUKlzk_PBTiYN2nO/D_g/x/OwTqYptQN/jrYC4bOWDEEe5hNKww" // URL VAST d'exemple
                  autoPlay={userHasInteracted}
                />
              ) : (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center text-center p-8">
                  <div className="flex items-center gap-3 text-muted-foreground animate-pulse">
                    <Tv className="w-8 h-8" />
                    <p className="text-xl font-semibold">En attente de sélection d'un flux...</p>
                  </div>
                  <p className="text-muted-foreground/80 mt-4 max-w-md mx-auto">
                    Choisissez une chaîne ou entrez une URL pour démarrer la lecture.
                  </p>
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