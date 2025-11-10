"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface StreamInputProps {
  onUrlSubmit: (url: string) => void;
  onRefresh: () => void;
}

export const StreamInput = ({ onUrlSubmit, onRefresh }: StreamInputProps) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Veuillez entrer une URL.");
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast.error("L'URL est invalide.", { description: "Elle doit commencer par http:// ou https://" });
      return;
    }
    onUrlSubmit(url);
  };

  return (
    <div className="flex w-full items-center gap-2">
      <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
        <Input
          type="url"
          placeholder="Entrez une URL de flux..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="bg-black/20 flex-1"
          aria-label="URL de flux personnalisée"
        />
        <Button type="submit" size="icon" aria-label="Lancer le flux">
          <Play className="h-4 w-4" />
        </Button>
      </form>
      <Button onClick={onRefresh} variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" aria-label="Rafraîchir la liste des chaînes">
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  );
};