const SUPABASE_URL = "https://btuujbfqtdwhdyhtvuys.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dXVqYmZxdGR3aGR5aHR2dXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2Njg2NzAsImV4cCI6MjA3NzI0NDY3MH0.tdllNxUzS-l1TnmMgjHyrHgUktjEUmpenyveQIh1jAo";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Supabase URL and Key are missing. Please create a .env file in the root of your project with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
}

let SUPABASE_PROJECT_ID = '';
try {
  const url = new URL(SUPABASE_URL);
  SUPABASE_PROJECT_ID = url.hostname.split('.')[0];
  if (!SUPABASE_PROJECT_ID) {
    throw new Error('Could not parse project ID from Supabase URL.');
  }
} catch (error) {
  throw new Error("Invalid Supabase URL format. It should be https://<project-id>.supabase.co");
}

export const supabaseConfig = {
  url: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
  projectId: SUPABASE_PROJECT_ID,
};