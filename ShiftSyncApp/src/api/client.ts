/**
 * ShiftSync API クライアント
 * バックエンド FastAPI との通信を担う
 */
import * as SecureStore from 'expo-secure-store';

// APIベースURL
// Render にデプロイされた本番URL（設定画面から変更可能）
const DEFAULT_API_URL = 'https://shiftsync-api-0ett.onrender.com';

/** URLの末尾スラッシュを除去する（//health になるのを防ぐ） */
function trimUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * 保存済みURLを取得する。
 * - 末尾スラッシュを自動除去
 * - ローカルIP / 旧URLが残っていた場合は Render URL に自動修正
 */
export async function getApiUrl(): Promise<string> {
  const saved = await SecureStore.getItemAsync('api_url');
  if (!saved) return DEFAULT_API_URL;

  // ローカルIPまたは旧URLが保存されていたら自動修正
  const isLocalUrl =
    saved.startsWith('http://192.168.') ||
    saved.startsWith('http://10.') ||
    saved.startsWith('http://172.') ||
    saved.startsWith('http://localhost') ||
    saved.startsWith('http://127.') ||
    saved === 'https://shiftsync-api.onrender.com'; // 旧URL

  if (isLocalUrl) {
    await SecureStore.setItemAsync('api_url', DEFAULT_API_URL);
    return DEFAULT_API_URL;
  }

  // 末尾スラッシュを除去して返す
  return trimUrl(saved);
}


// デフォルトタイムアウト（通常リクエスト: 90秒、ヘルスチェック: 10秒）
const DEFAULT_TIMEOUT_MS = 90_000;

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const baseUrl = trimUrl(await getApiUrl());
  const url = `${baseUrl}${path}`;

  // AbortController でタイムアウト制御
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timerId);
  }
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
/**
 * サーバーのヘルスチェック。
 * Render 無料プランはスリープから起動に最大60秒かかるため、
 * タイムアウトまでリトライし続ける。
 * @param totalWaitMs 合計待機時間（デフォルト: 65秒）
 * @param onWaiting   「起動中」コールバック（UIに進捗を伝える用）
 */
export async function checkHealth(
  totalWaitMs = 65_000,
  onWaiting?: (elapsedMs: number) => void
): Promise<boolean> {
  const started = Date.now();
  const PROBE_TIMEOUT = 10_000; // 1回あたりのタイムアウト
  const RETRY_INTERVAL = 4_000; // リトライ間隔

  while (Date.now() - started < totalWaitMs) {
    try {
      const res = await request<{ status: string }>('/health', {}, PROBE_TIMEOUT);
      if (res.status === 'healthy') return true;
    } catch {
      // スリープ中・起動中は接続エラーになるので継続
    }
    const elapsed = Date.now() - started;
    if (onWaiting) onWaiting(elapsed);
    // 残り時間がなければ終了
    if (elapsed + RETRY_INTERVAL >= totalWaitMs) break;
    await new Promise(r => setTimeout(r, RETRY_INTERVAL));
  }
  return false;
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

