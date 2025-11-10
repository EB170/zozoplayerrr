export const LOGO_MAP: Record<string, string> = {
  'bein': 'https://i.ibb.co/KjTYxjCy/beinsport.png',
  'canal': 'https://i.ibb.co/TBSGHnCH/canal.png',
  'foot+': 'https://i.ibb.co/TBSGHnCH/canal.png',
  'golf+': 'https://i.ibb.co/TBSGHnCH/canal.png',
  'infosport': 'https://i.ibb.co/TBSGHnCH/canal.png',
  'eurosport': 'https://i.ibb.co/MkMt0DHn/eurosport.png',
  'equipe': 'https://i.ibb.co/4w4Cxt8t/lequipe.png',
  'ligue 1': 'https://i.ibb.co/wZR2LVFq/ligue1.png',
  'rmc': 'https://i.ibb.co/gb5mBxVR/rmcsport.png',
};

export const getLogoForChannel = (channelName: string): string => {
  const lowerChannelName = channelName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // enlève les accents

  for (const key in LOGO_MAP) {
    if (lowerChannelName.includes(key)) {
      return LOGO_MAP[key];
    }
  }
  return '/placeholder.svg'; // Un logo de secours fiable
};