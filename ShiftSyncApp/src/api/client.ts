/**
 * ShiftSync API クライアント
 * バックエンド FastAPI との通信を担う
 */
import * as SecureStore from 'expo-secure-store';

// APIベースURL
// Render にデプロイされた本番URL（設定画面から変更可能）
const DEFAULT_API_URL = 'https://shiftsync-api-0ett.onrender.com';

export async function getApiUrl(): Promise<string> {
  const saved = await SecureStore.getItemAsync('api_url');
  return saved || DEFAULT_API_URL;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getApiUrl();
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ────────────────────────────────
// 認証情報
// ────────────────────────────────
export async function saveCredentials(staffId: string, password: string) {
  await SecureStore.setItemAsync('shifucon_staff_id', staffId);
  await SecureStore.setItemAsync('shifucon_password', password);
}

export async function loadCredentials(): Promise<{ staffId: string; password: string } | null> {
  const staffId = await SecureStore.getItemAsync('shifucon_staff_id');
  const password = await SecureStore.getItemAsync('shifucon_password');
  if (staffId && password) return { staffId, password };
  return null;
}

export async function clearCredentials() {
  await SecureStore.deleteItemAsync('shifucon_staff_id');
  await SecureStore.deleteItemAsync('shifucon_password');
}

// ────────────────────────────────
// シフト
// ────────────────────────────────
export interface ShiftResponse {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  store_name: string;
  note: string;
  source: string;
  gcal_event_id: string | null;
  synced_at: string | null;
}

export async function fetchShifts(year: number, month: number): Promise<ShiftResponse[]> {
  return request<ShiftResponse[]>(`/shifts/${year}/${month}`);
}

// ────────────────────────────────
// 同期
// ────────────────────────────────
export interface SyncRequest {
  year?: number;
  month?: number;
  sync_to_gcal?: boolean;
  force_first_run?: boolean;  // trueの場合は初回モードを強制
}

export interface SyncResponse {
  scraped: number;
  added_to_db: number;
  gcal_added: number;
  gcal_skipped: number;
  gcal_errors: number;
  message: string;
}

export async function triggerSync(body: SyncRequest): Promise<SyncResponse> {
  return request<SyncResponse>('/shifts/sync/blocking', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 年初（1/1）〜翌月末まで全件強制再取得・upsert */
export async function fullResetSync(): Promise<SyncResponse> {
  return request<SyncResponse>('/shifts/sync/full-reset', {
    method: 'POST',
  });
}


// ────────────────────────────────
// 統計
// ────────────────────────────────
export interface MonthlyStats {
  year: number;
  month: number;
  total_shifts: number;
  total_hours: number;
  estimated_income: number;
  hourly_wage: number;
  shift_dates: string[];
  daily_hours: Record<string, number>;
}

export async function fetchMonthlyStats(year: number, month: number): Promise<MonthlyStats> {
  return request<MonthlyStats>(`/stats/${year}/${month}`);
}

// ────────────────────────────────
// 設定
// ────────────────────────────────
export interface SettingsResponse {
  hourly_wage: number;
  notify_enabled: boolean;
  notify_time: string;
  notify_days_before: number;
}

export async function fetchSettings(): Promise<SettingsResponse> {
  return request<SettingsResponse>('/settings');
}

export async function updateSettings(body: Partial<SettingsResponse>): Promise<SettingsResponse> {
  return request<SettingsResponse>('/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// ────────────────────────────────
// ヘルスチェック
// ────────────────────────────────
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await request<{ status: string }>('/health');
    return res.status === 'healthy';
  } catch {
    return false;
  }
}

// ────────────────────────────────
// カレンダー操作
// ────────────────────────────────
export interface DeleteGcalResponse {
  deleted: number;
  errors: number;
  message: string;
}

export async function deleteAllGcalEvents(): Promise<DeleteGcalResponse> {
  return request<DeleteGcalResponse>('/shifts/gcal/all', {
    method: 'DELETE',
  });
}

