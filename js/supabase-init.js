const SUPABASE_URL = "https://supabase.com/dashboard/project/tqjutrukibhtxzovbppq/sql/85e52f03-6f9f-41be-bbd2-92ae5299116d";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxanV0cnVraWJodHh6b3ZicHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNjg4MzQsImV4cCI6MjEwMTY0NDgzNH0.kHFcbIk5txLh3NHLDxjzf-cAAlkuwdxhAgJJ-GL7BMk";

window.supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
