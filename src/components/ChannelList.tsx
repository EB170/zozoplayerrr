"use client";

import { memo, useMemo } from 'react';
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogoForChannel } from "@/config/logo-map";
import { Star } from "lucide-react";

type Channel = Tables<'channels'>;

interface ChannelListItemProps {
  channel: Channel;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channelName: string, e: React.MouseEvent) => void;
}

const ChannelListItem = memo(({ channel, isSelected, isFavorite, onSelect, onToggleFavorite }: ChannelListItemProps) => {
  return (
    <li
      onClick={() => onSelect(channel)}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-primary/20",
        isSelected ? "bg-primary/20" : "bg-transparent"
      )}
    >
      <div className="w-10 h-10 flex-shrink-0 rounded-md bg-white/5 flex items-center justify-center overflow-hidden">
        <img src={getLogoForChannel(channel.name)} alt={channel.name} className="max-w-[90%] max-h-[90%] object-contain" />
      </div>
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-semibold text-foreground truncate">{channel.name}</p>
        <p className="text-xs text-muted-foreground">{channel.provider}</p>
      </div>
      {isSelected && (
        <div className="flex items-center gap-1.5 text-red-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-xs font-bold">LIVE</span>
        </div>
      )}
      <button onClick={(e) => onToggleFavorite(channel.name, e)} className="p-1 opacity-50 hover:opacity-100">
        <Star className={cn("w-4 h-4 transition-colors", isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
      </button>
    </li>
  );
});


interface ChannelListProps {
  channels: Channel[];
  selectedChannelName: string;
  onChannelSelect: (channel: Channel) => void;
  onToggleFavorite: (channelName: string, e: React.MouseEvent) => void;
  favorites: string[];
  isLoading: boolean;
  layout?: 'sidebar' | 'inline';
}

export const ChannelList = memo(({ channels, selectedChannelName, onChannelSelect, onToggleFavorite, favorites, isLoading, layout = 'sidebar' }: ChannelListProps) => {
  const isSidebar = layout === 'sidebar';

  const { favoriteChannels, groupedChannels } = useMemo(() => {
    const favs: Channel[] = [];
    const groups: Record<string, Channel[]> = {};

    for (const channel of channels) {
      if (favorites.includes(channel.name)) {
        favs.push(channel);
      }
      const provider = channel.provider || 'Autres Chaînes';
      if (!groups[provider]) {
        groups[provider] = [];
      }
      groups[provider].push(channel);
    }
    return { favoriteChannels: favs, groupedChannels: groups };
  }, [channels, favorites]);

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

  const renderChannel = (channel: Channel) => (
    <ChannelListItem
      key={channel.id}
      channel={channel}
      isSelected={selectedChannelName === channel.name}
      isFavorite={favorites.includes(channel.name)}
      onSelect={onChannelSelect}
      onToggleFavorite={onToggleFavorite}
    />
  );

  return (
    <div className={cn(
      "p-4 space-y-6",
      isSidebar ? "flex-1 overflow-y-auto custom-scrollbar" : ""
    )}>
      {favoriteChannels.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-yellow-400 mb-2 px-2.5 flex items-center gap-2"><Star className="w-4 h-4" /> Favoris</h3>
          <ul className="space-y-1">
            {favoriteChannels.map(renderChannel)}
          </ul>
        </section>
      )}
      {Object.entries(groupedChannels).map(([provider, providerChannels]) => (
        <section key={provider}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-2.5">{provider}</h3>
          <ul className="space-y-1">
            {providerChannels.map(renderChannel)}
          </ul>
        </section>
      ))}
    </div>
  );
});