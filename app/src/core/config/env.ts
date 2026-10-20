// Environment configuration. Values come from app config — never hardcode secrets.
// Supabase anon key is a publishable key (safe for client use); service-role keys must NEVER be bundled.

export const ENV = {
  supabaseUrl: 'https://zfaehmpnfsgqsfypwiip.supabase.co',
  supabaseAnonKey: 'sb_publishable_-av7DTOT_yDhHVXz0eCvQw_AMQPKhL-',
  appVersion: '1.0.0',
  // Admin dashboard backend — device registration and license API.
  dashboardUrl: 'https://darzi-dashboard.vercel.app',
  // Offline grace period for cached license: 30 days before forcing revalidation.
  licenseOfflineGraceDays: 30,
} as const;
