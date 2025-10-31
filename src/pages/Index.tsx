import { useState, useEffect } from "react";
import { VideoPlayerHybrid } from "@/components/VideoPlayerHybrid";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Keep sonner for other toasts
import { Video, Tv, Link as LinkIcon, Play } from "lucide-react";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import EventCard from "@/components/EventCard"; // Import the new EventCard component

const PREDEFINED_CHANNELS = [
  { name: "EUROSPORT 1", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/65922" },
  { name: "EUROSPORT 2", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/65924" },
  { name: "CANAL+", url: "https://satoshi-cors.herokuapp.com/http://151.80.18.177:86/Canal+_HD/index.m3u8" },
  { name: "CANAL+ SPORT", url: "https://satoshi-cors.herokuapp.com/http://151.80.18.177:86/Canal+_sport_HD/index.m3u8" },
  { name: "CANAL+ GOLF", url: "https://satoshi-cors.herokuapp.com/http://151.80.18.177:86/GOLF+_HD/index.m3u8" },
  { name: "CANAL+ FOOT", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/65934" },
  { name: "BEIN SPORT 1", url: "https://satoshi-cors.herokuapp.com/http://5.9.119.146:8883/beinfr1/index.m3u8" },
  { name: "BEIN SPORT 2", url: "https://satoshi-cors.herokuapp.com/http://5.9.119.146:8883/beinfr2/index.m3u8" },
  { name: "BEIN SPORT 3", url: "https://satoshi-cors.herokuapp.com/http://5.9.119.146:8883/sf1_bein_hd3_fr/index.m3u8" },
  { name: "RMC SPORT 1", url: "https://satoshi-cors.herokuapp.com/http://5.9.119.146:8883/rmc1/index.m3u8" },
  { name: "RMC SPORT 2", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/591256" },
  { name: "RMC SPORT 3", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/591255" },
  { name: "ESPN", url: "https://02.arlivre.online/espn/index.m3u8" },
  { name: "ESPN 2", url: "https://02.arlivre.online/espn2/index.m3u8" },
  { name: "ESPN 3", url: "https://02.arlivre.online/espn3/index.m3u8" },
  { name: "ESPN 4", url: "https://02.arlivre.online/espn4/index.m3u8" },
  { name: "LIGUE 1+", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/612101" },
  { name: "LIGUE 1+ 2", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/612100" },
  { name: "LIGUE 1+ 3", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/612099" },
  { name: "LIGUE 1+ 4", url: "https://satoshi-cors.herokuapp.com/http://x02x.live:8080/y1s3HkjU/jchcPTU/612098" }
];

const VAST_AD_URL = "https://frail-benefit.com/dSm.FXzfdiGMNjv/ZcGAUP/Behm/9DuzZvUmlfkiP/TdYs2aO/T/AzxuNtDuYEtGNcjJY/5cMeDUEt0UNvwn";

const Index = () => {
  const [streamUrl, setStreamUrl] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const handleChannelSelect = (channelName: string) => {
    const channel = PREDEFINED_CHANNELS.find(ch => ch.name === channelName);
    if (channel) {
      setSelectedChannel(channelName);
      setStreamUrl(channel.url);
      setCustomUrl(""); // Clear custom URL when selecting from list
      toast.success(`📺 Chargement de ${channel.name}`, {
        description: "La publicité va démarrer, suivie du flux.",
        duration: 3000,
      });
    }
  };

  const handleCustomUrlSubmit = () => {
    if (!customUrl.trim()) {
      toast.error("URL vide", {
        description: "Veuillez entrer une URL valide"
      });
      return;
    }

    // Basic validation
    if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
      toast.error("URL invalide", {
        description: "L'URL doit commencer par http:// ou https://"
      });
      return;
    }

    setStreamUrl(customUrl);
    setSelectedChannel(""); // Clear channel selection
    toast.success("🔗 Chargement du flux personnalisé", {
      description: "La publicité va démarrer, suivie du flux.",
      duration: 3000,
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center mb-6">
            <img src="/logo.png" alt="ZozoPlayer" className="h-16 md:h-20 object-contain" />
          </div>
        </div>

        {/* Channel Selection Card */}
        <Card className="p-6 bg-card/90 backdrop-blur border-border shadow-lg">
          <div className="space-y-4">
            {/* Sport Channels Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Tv className="w-4 h-4 text-primary" />
                Chaînes de sport
              </label>
              <Select value={selectedChannel} onValueChange={handleChannelSelect}>
                <SelectTrigger className="w-full bg-input border-border text-foreground font-medium">
                  <SelectValue placeholder="Sélectionner une chaîne..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border max-h-[300px] z-[100]">
                  {PREDEFINED_CHANNELS.map(channel => (
                    <SelectItem key={channel.name} value={channel.name} className="cursor-pointer hover:bg-accent">
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            {/* Custom URL Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-primary" />
                URL personnalisée (HLS/MPEG-TS)
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://exemple.com/stream.m3u8"
                  className="flex-1 bg-input border-border text-foreground"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomUrlSubmit();
                    }
                  }}
                />
                <Button
                  onClick={handleCustomUrlSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!customUrl.trim()}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Lire
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Formats supportés : HLS (.m3u8), MPEG-TS (.ts) • Lecture live 24/7 • Auto-reconnexion
            </p>
          </div>
        </Card>

        {/* Video Player */}
        {streamUrl ? (
          <div className="animate-in fade-in zoom-in slide-in-from-bottom-4 duration-700">
            <VideoPlayerHybrid 
              streamUrl={streamUrl} 
              vastUrl={VAST_AD_URL}
              autoPlay 
            />
          </div>
        ) : (
          <Card className="p-12 bg-card border-border border-dashed hover:border-primary/50 transition-all duration-300">
            <div className="text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-primary/10 animate-pulse">
                <Video className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Aucun flux actif</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Sélectionnez une chaîne de sport ci-dessus pour commencer la lecture en direct
              </p>
              <p className="text-xs text-muted-foreground/60">
                💡 Astuce : Utilisez les raccourcis clavier une fois la lecture démarrée
              </p>
            </div>
          </Card>
        )}

        {/* Upcoming Events Section */}
        <div className="space-y-6 pt-8">
          <h2 className="text-2xl font-bold text-foreground text-center">Évènements à venir</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <EventCard
              imageUrl="/card1.jpg"
              title="Brazilian Grand Prix"
              date="dim. 9 nov., 18:00"
            />
            <EventCard
              imageUrl="/card2.jpg"
              title="UFC Fight Night"
              date="dim. 2 nov., 00:00"
            />
            {/* Ajoutez d'autres EventCard ici si nécessaire */}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
            <h3 className="font-semibold mb-2 text-primary">⚡ Zéro coupure</h3>
            <p className="text-sm text-muted-foreground">
              Reconnexion automatique en cas de problème réseau ou de flux
            </p>
          </Card>
          <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
            <h3 className="font-semibold mb-2 text-accent">🎯 Latence minimale</h3>
            <p className="text-sm text-muted-foreground">
              Buffer optimisé pour une lecture en direct avec le minimum de retard
            </p>
          </Card>
          <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
            <h3 className="font-semibold mb-2 text-[hsl(var(--success))]">🔄 24/7 Live</h3>
            <p className="text-sm text-muted-foreground">
              Conçu pour la lecture continue de flux en direct sans interruption
            </p>
          </Card>
        </div>
      </div>
      <PWAInstallPrompt />
    </div>
  );
};

export default Index;