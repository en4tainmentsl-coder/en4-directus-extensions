// Single-tenant config. The anon key is a public credential by design —
// it grants nothing on its own; every sensitive path is gated by RLS or by
// the role check inside r2-deliver.
export const SUPABASE_URL = 'https://sqovyodycuyajmumcjnn.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxb3Z5b2R5Y3V5YWptdW1jam5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDkzODIsImV4cCI6MjA4NjQyNTM4Mn0.TAxnooD1SGKwcyMqJCwtKyHKhasTD7oEz1u40oLdy9s';