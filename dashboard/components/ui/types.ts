export type LicenseStatus =
  | "active"
  | "disabled"
  | "expired"
  | "pending";

export interface LicenseSummary {
  key_hint: string;
  status: LicenseStatus;
  expires_at: string | null;
}

export interface Device {
  id: string;
  device_id: string;
  customer_name: string | null;
  manufacturer: string | null;
  model: string | null;
  android_version: string | null;
  app_version: string | null;
  registered_at: string;
  last_seen_at: string | null;
  license: LicenseSummary | null;
}

export interface DeviceListResponse {
  data: Device[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface DeviceDetailResponse {
  device: Device;
  license: (LicenseSummary & {
    key: string;
    created_at?: string;
    customer_name?: string | null;
  }) | null;
  events: ActivityEvent[];
}

export interface LicenseRow {
  key_hint: string;
  status: LicenseStatus;
  expires_at: string | null;
  created_at?: string;
  customer_name?: string | null;
  device_id?: string;
  device_db_id?: string;
}

export interface LicenseListResponse {
  data: LicenseRow[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface LicenseDetail {
  key: string;
  key_hint: string;
  status: LicenseStatus;
  expires_at: string | null;
  created_at?: string;
  customer_name?: string | null;
  device_id?: string | null;
}

export interface ActivityEvent {
  id?: string | number;
  event_type?: string;
  type?: string;
  outcome?: string;
  device_id?: string;
  customer_name?: string;
  created_at?: string;
  at?: string;
  detail?: string;
  message?: string;
}

export interface ActivityResponse {
  data: ActivityEvent[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Metrics {
  total_devices: number;
  keys_generated: number;
  active_licenses: number;
  disabled_licenses: number;
  expired_licenses: number;
  unused_keys: number;
  pending_devices: number;
  activations_last_7d: number;
}

export interface AppSettings {
  default_license_days: number;
  business_name: string;
  owner_name: string;
  timezone: string;
}

export interface GenerateKeyResponse {
  created: boolean;
  key: string;
  key_hint: string;
  expires_at: string | null;
}
