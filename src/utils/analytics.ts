import { supabase } from "@/integrations/supabase/client";

interface ErrorLog {
  error_type: string;
  error_details: string;
  stream_url: string;
  player_type: 'hls' | 'mpegts' | 'vast';
  is_fatal: boolean;
}

export const logError = async (log: ErrorLog) => {
  try {
    const { error } = await supabase.from('player_errors').insert({
      ...log,
      user_agent: navigator.userAgent,
    });

    if (error) {
      console.error("Analytics logging failed:", error.message);
    }
  } catch (e) {
    console.error("Analytics submission failed:", e);
  }
};