"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

interface EventCardProps {
  imageUrl: string;
  title: string;
  date: string;
}

const EventCard: React.FC<EventCardProps> = ({ imageUrl, title, date }) => {
  return (
    <Card className="relative w-full overflow-hidden rounded-lg border-border shadow-lg group hover:shadow-card-hover transition-all duration-300 ease-in-out">
      <div className="relative w-full aspect-video overflow-hidden">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>
      <CardContent className="absolute bottom-0 left-0 right-0 p-4 text-white space-y-2">
        <h3 className="text-lg md:text-xl font-bold text-foreground drop-shadow-md">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground drop-shadow-sm">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="font-medium">{date}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventCard;