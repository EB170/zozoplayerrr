import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tv, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { StreamInput } from "@/components/StreamInput";
import { ChannelList } from "@/components/ChannelList";
import type { VideoPlayerRef } from "@/components/VideoPlayerHybrid";

const VideoPlayerHybrid = lazy(() => import("@/components/VideoPlayerHybrid"));

type Channel = Tables<'channels'>;

const Index = () => {
  const [streamUrl, setStreamUrl] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
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
    if (storedFavorites) {
      try {
        setFavorites(JSON.parse(storedFavorites));
      } catch (e) {
        console.error("Failed to parse favorites from localStorage", e);
        setFavorites([]);
      }
    }
  }, []);

  const handleChannelSelect = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setStreamUrl(channel.urls[0]);
    toast.info(`▶️ Lancement de ${channel.name}...`);
  }, []);

  const handleCustomUrlSubmit = useCallback((url: string) => {
    setSelectedChannel(null);
    setStreamUrl(url);
    toast.info(`▶️ Lancement de l'URL personnalisée...`);
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['channels'] });
    toast.info("Liste des chaînes rafraîchie !");
  }, [queryClient]);

  const toggleFavorite = useCallback((channelName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(currentFavorites => {
      const newFavorites = currentFavorites.includes(channelName)
        ? currentFavorites.filter(name => name !== channelName)
        : [...currentFavorites, channelName];
      localStorage.setItem("favoriteChannels", JSON.stringify(newFavorites));
      toast.success(currentFavorites.includes(channelName) ? `${channelName} retiré des favoris` : `⭐ ${channelName} ajouté aux favoris !`);
      return newFavorites;
    });
  }, []);

  const channelListProps = {
    channels,
    selectedChannelName: selectedChannel?.name || "",
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
          <ChannelList {...channelListProps} />
        </aside>
        
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="w-full md:px-8 md:pt-8 flex-shrink-0">
            <div className="relative w-full aspect-video md:rounded-lg overflow-hidden shadow-glow bg-black">
              {streamUrl ? (
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center bg-black">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  </div>
                }>
                  <VideoPlayerHybrid ref={playerRef} streamUrl={streamUrl} autoPlay={true} />
                </Suspense>
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
                <ChannelList {...channelListProps} layout="inline" />
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
    </div>
  );
};

export default Index;