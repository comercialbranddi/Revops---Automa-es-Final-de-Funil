/**
 * Leitura do Supabase da Lia (projeto `rpqfxrmqsgiqzkroxemk`) via PostgREST puro
 * — sem @supabase/supabase-js, porque tudo que o painel faz é SELECT.
 *
 * As tabelas de evento têm RLS ligado e nenhuma policy pra `anon`, então só a
 * SERVICE ROLE KEY lê. Ela só é usada em route handlers (server-side); nunca
 * é exposta pro browser. Sem a credencial, cada função devolve null/[] e o
 * painel degrada pras seções que só dependem do Pipedrive.
 */

export function supabaseConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Uma chave `anon` não dá erro nas tabelas com RLS — o PostgREST devolve 200 com
 * lista vazia. Sem esta checagem o painel diria "Supabase conectado" e mostraria
 * tudo zerado, que é o pior tipo de falha num painel de observabilidade.
 */
export function chaveEhServiceRole(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return false;
  if (key.startsWith("sb_secret_")) return true;
  if (key.startsWith("sb_publishable_")) return false;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString("utf8"));
    return payload.role === "service_role";
  } catch {
    // Formato desconhecido — deixa passar e o erro real aparece na leitura.
    return true;
  }
}

async function select<T>(path: string): Promise<T[]> {
  if (!supabaseConfigurado()) return [];
  const url = `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} em ${path.split("?")[0]}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T[];
}

/**
 * PostgREST monta o filtro `in` na querystring; com ~400 ids a URL estoura o
 * limite de tamanho de alguns proxies. Quebra em lotes e concatena.
 */
async function selectPorDealIds<T>(
  tabela: string,
  colunas: string,
  dealIds: number[],
  extra = "",
  campoId = "deal_id"
): Promise<T[]> {
  const LOTE = 150;
  const out: T[] = [];
  for (let i = 0; i < dealIds.length; i += LOTE) {
    const ids = dealIds.slice(i, i + LOTE).join(",");
    const rows = await select<T>(
      `${tabela}?select=${colunas}&${campoId}=in.(${ids})${extra}`
    );
    out.push(...rows);
  }
  return out;
}

export type LogStep = { ts?: string; time?: string; icon?: string; msg?: string };

export type DealProcessingLog = {
  deal_id: number;
  status: string | null;
  stage: string | null;
  steps: LogStep[] | null;
  started_at: string | null;
  updated_at: string | null;
};

export type AutomationError = {
  id: number;
  deal_id: number;
  org_name: string | null;
  stage: string;
  error_type: string;
  error_detail: string | null;
  retries: number | null;
  occurred_at: string;
  resolved_at: string | null;
};

export type PlacarPonto = {
  person: string;
  points: number;
  reason: string;
  deal_id: number | null;
  org_name: string | null;
  created_at: string;
};

export type SorteioEntry = {
  person_name: string;
  email: string | null;
  source: string;
  deal_id: number | null;
  created_at: string;
};

export type ReportDispatch = { deal_id: number; dispatched_at: string };

export function fetchDealLogs(dealIds: number[]) {
  return selectPorDealIds<DealProcessingLog>(
    "deal_processing_logs",
    "deal_id,status,stage,steps,started_at,updated_at",
    dealIds
  );
}

export function fetchAutomationErrors(dealIds: number[]) {
  return selectPorDealIds<AutomationError>(
    "automation_errors",
    "id,deal_id,org_name,stage,error_type,error_detail,retries,occurred_at,resolved_at",
    dealIds,
    "&order=occurred_at.desc"
  );
}

export function fetchReportDispatches(dealIds: number[]) {
  return selectPorDealIds<ReportDispatch>(
    "event_report_dispatches",
    "deal_id,dispatched_at",
    dealIds
  );
}

export function fetchPlacar() {
  return select<PlacarPonto>(
    "evento_placar_pontos?select=person,points,reason,deal_id,org_name,created_at&order=created_at.desc&limit=2000"
  );
}

export function fetchSorteio() {
  return select<SorteioEntry>(
    "evento_sorteio_entries?select=person_name,email,source,deal_id,created_at&order=created_at.desc&limit=2000"
  );
}
