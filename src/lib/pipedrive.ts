const PIPEDRIVE_V1 = "https://api.pipedrive.com/v1";
const PIPEDRIVE_V2 = "https://api.pipedrive.com/api/v2";
export const PIPELINE_EVENTOS = 25;

export const STAGES = {
  NOVO_LEAD: 315,
  MONITORIA: 501,
  RELATORIO_REPROVADO: 502,
  // 503 era "Relatório Enviado" (sempre vazio) e foi reaproveitado em 29/07
  // pra separar o lead que entra com e-mail de domínio pessoal dos outros
  // motivos de reprovação.
  EMAILS_REPROVADOS: 503,
  PROSPECCAO_ATIVA: 504,
  SEM_RESPOSTA: 505,
  RESPONDEU: 506,
  REUNIAO_AGENDADA: 319,
  REUNIAO_REALIZADA: 401,
  EVENTO_ANTIGO: 500,
} as const;

export const STAGE_NAMES: Record<number, string> = {
  315: "Novo Lead",
  501: "Monitoria",
  502: "Relatório Reprovado",
  503: "E-mails Reprovados",
  504: "Prospecção Ativa",
  505: "Sem resposta",
  506: "Respondeu",
  319: "Reunião Agendada",
  401: "Reunião Realizada",
  500: "Evento Antigo",
};

// Ordem de leitura do funil (a ordem do Pipedrive coloca 319/401 no mesmo
// order_nr, então fixamos aqui pra o painel não depender disso).
export const FUNIL_ORDEM: number[] = [
  STAGES.NOVO_LEAD,
  STAGES.MONITORIA,
  STAGES.RELATORIO_REPROVADO,
  STAGES.EMAILS_REPROVADOS,
  STAGES.PROSPECCAO_ATIVA,
  STAGES.SEM_RESPOSTA,
  STAGES.RESPONDEU,
  STAGES.REUNIAO_AGENDADA,
  STAGES.REUNIAO_REALIZADA,
];

// Estágio legado do evento anterior — fica fora do funil vivo, mas é contado
// à parte pra ninguém achar que os cards sumiram.
export const STAGE_LEGADO = STAGES.EVENTO_ANTIGO;

export const LOST_REASON_CLIENTE_ATIVO = 1582;

export const FIELD = {
  RELATORIO_HTML: "d9a9920ec8517f9603a121ba48f0a6af87e455f3",
  ORIGEM_DO_LEAD: "0c60a8179f542f1c7b0846a6c16e476b0ffece52",
  COMPANY_SCORE: "dc70ae6a9f2b53c6940c30170fa209c3d4f2677b",
  EVENTO: "efd986dda122be48294cb84116339a11de09d6e8",
  EMAIL_VALIDADO: "4b2f5930d3ee01107aefea894a1190433b162052",
  OBSERVACAO: "ffa2518c9c1f977e4c7a89e762b78ddcf3758542",
} as const;

export const ORIGEM_LEAD_OPTIONS: Record<number, string> = {
  1551: "Estande",
  1552: "Pré-cadastro LinkedIn",
  1580: "QR Estande",
  1581: "Monitoria VC / Buy Box",
};

export const EMAIL_VALIDADO_OPTIONS: Record<number, string> = {
  1525: "Sim",
  1526: "Não",
};

/** Shape normalizado — v1 e v2 do Pipedrive devolvem formatos diferentes. */
export interface EventoDeal {
  id: number;
  title: string;
  orgName: string | null;
  orgId: number | null;
  personName: string | null;
  /** Só vem preenchido pela v1 (embutido no /pipelines/25/deals) — v2 fica null. */
  personEmail: string | null;
  stageId: number;
  status: "open" | "won" | "lost";
  addTime: string; // ISO com Z
  updateTime: string | null;
  stageChangeTime: string | null;
  lostTime: string | null;
  lostReason: string | null;
  origem: string;
  companyScore: number | null;
  relatorioHtml: string | null;
  emailValidado: string | null;
  observacao: string | null;
  /** Quem do time captou o lead. Pode ser mais de um no mesmo card. */
  colaboradores: string[];
}

/**
 * O campo "Observação/Status" é onde as Edge Functions de captação gravam quem
 * trouxe o lead (`mergeOwners`). Quando duas pessoas trabalham o mesmo card o
 * valor vira "Ana Vitória, Alicia" — as duas levam o crédito.
 */
export function parseColaboradores(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pipedriveCardUrl(dealId: number): string {
  return `https://app.pipedrive.com/deal/${dealId}`;
}

/**
 * Pipedrive v1 devolve "YYYY-MM-DD HH:MM:SS" em UTC sem marcador de timezone —
 * sem o "Z" o JS trataria como horário local (3h adiantado no BRT). v2 já
 * devolve ISO com Z. Normalizamos os dois pro mesmo formato.
 */
function toIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.includes("T")) return raw;
  return `${raw.replace(" ", "T")}Z`;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function origemFrom(id: unknown): string {
  const n = num(id);
  if (!n) return "Não informada";
  return ORIGEM_LEAD_OPTIONS[n] || "Não informada";
}

/**
 * lost_reason vem ora como texto livre ("Sem Potencial"), ora como id da opção
 * do enum (1582 = cliente Branddi ativo). Traduz o id conhecido e devolve o
 * resto como veio.
 */
function lostReasonLabel(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw);
  if (s === String(LOST_REASON_CLIENTE_ATIVO)) return "Cliente Branddi ativo (não enviar pra evento)";
  return s;
}

type V1Deal = Record<string, unknown> & {
  id: number;
  title: string;
  org_name: string | null;
  org_id: unknown;
  person_name: string | null;
  stage_id: number;
  status: EventoDeal["status"];
  add_time: string;
  update_time: string;
  stage_change_time: string | null;
  lost_time: string | null;
  lost_reason: unknown;
};

function emailFromPersonId(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const email = (raw as { email?: unknown }).email;
  if (!Array.isArray(email) || !email.length) return null;
  const primeiro = email.find((e) => e && (e as { primary?: boolean }).primary) ?? email[0];
  return (primeiro as { value?: string })?.value || null;
}

function normalizeV1(d: V1Deal): EventoDeal {
  const orgId = typeof d.org_id === "object" && d.org_id !== null
    ? num((d.org_id as { value?: unknown }).value)
    : num(d.org_id);
  return {
    id: d.id,
    title: d.title,
    orgName: d.org_name || null,
    orgId,
    personName: d.person_name || null,
    personEmail: emailFromPersonId(d.person_id),
    stageId: d.stage_id,
    status: d.status,
    addTime: toIso(d.add_time)!,
    updateTime: toIso(d.update_time),
    stageChangeTime: toIso(d.stage_change_time),
    lostTime: toIso(d.lost_time),
    lostReason: lostReasonLabel(d.lost_reason),
    origem: origemFrom(d[FIELD.ORIGEM_DO_LEAD]),
    companyScore: num(d[FIELD.COMPANY_SCORE]),
    relatorioHtml: (d[FIELD.RELATORIO_HTML] as string) || null,
    emailValidado: EMAIL_VALIDADO_OPTIONS[num(d[FIELD.EMAIL_VALIDADO]) ?? -1] || null,
    observacao: (d[FIELD.OBSERVACAO] as string) || null,
    colaboradores: parseColaboradores(d[FIELD.OBSERVACAO]),
  };
}

type V2Deal = {
  id: number;
  title: string;
  org_id: number | null;
  person_id: number | null;
  stage_id: number;
  status: EventoDeal["status"];
  add_time: string;
  update_time: string;
  stage_change_time: string | null;
  lost_time: string | null;
  lost_reason: unknown;
  custom_fields?: Record<string, unknown>;
};

function normalizeV2(d: V2Deal): EventoDeal {
  const cf = d.custom_fields || {};
  return {
    id: d.id,
    title: d.title,
    // v2 não devolve org_name; o título do card de evento é o nome da empresa.
    orgName: null,
    orgId: d.org_id ?? null,
    personName: null,
    personEmail: null,
    stageId: d.stage_id,
    status: d.status,
    addTime: toIso(d.add_time)!,
    updateTime: toIso(d.update_time),
    stageChangeTime: toIso(d.stage_change_time),
    lostTime: toIso(d.lost_time),
    lostReason: lostReasonLabel(d.lost_reason),
    origem: origemFrom(cf[FIELD.ORIGEM_DO_LEAD]),
    companyScore: num(cf[FIELD.COMPANY_SCORE]),
    relatorioHtml: (cf[FIELD.RELATORIO_HTML] as string) || null,
    emailValidado: EMAIL_VALIDADO_OPTIONS[num(cf[FIELD.EMAIL_VALIDADO]) ?? -1] || null,
    observacao: (cf[FIELD.OBSERVACAO] as string) || null,
    colaboradores: parseColaboradores(cf[FIELD.OBSERVACAO]),
  };
}

function token(): string {
  const t = process.env.PIPEDRIVE_API_TOKEN;
  if (!t) throw new Error("PIPEDRIVE_API_TOKEN não configurado");
  return t;
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Pipedrive respondeu ${res.status}`);
  const json = await res.json();
  if (json.success === false) {
    throw new Error(json.error || "Erro desconhecido na API do Pipedrive");
  }
  return json;
}

/**
 * Abertos vêm da v1 (`/pipelines/25/deals`): é o único endpoint que devolve
 * org_name junto. O parâmetro `status` dele é ignorado pelo Pipedrive — ele
 * sempre responde só os abertos, e é por isso que perdidos/ganhos precisam da v2.
 */
async function fetchAbertos(): Promise<EventoDeal[]> {
  const out: EventoDeal[] = [];
  let start = 0;
  for (;;) {
    const json = await getJson(
      `${PIPEDRIVE_V1}/pipelines/${PIPELINE_EVENTOS}/deals?start=${start}&limit=500&api_token=${token()}`
    );
    out.push(...((json.data || []) as V1Deal[]).map(normalizeV1));
    const p = json.additional_data?.pagination;
    if (!p?.more_items_in_collection) break;
    start = p.next_start;
  }
  return out;
}

/**
 * Perdidos/ganhos só saem da v2 — na v1 o filtro `pipeline_id` é ignorado e a
 * resposta vem com o CRM inteiro (50k+ deals).
 */
async function fetchPorStatus(status: "lost" | "won"): Promise<EventoDeal[]> {
  const out: EventoDeal[] = [];
  let cursor: string | null = null;
  for (;;) {
    const url =
      `${PIPEDRIVE_V2}/deals?pipeline_id=${PIPELINE_EVENTOS}&status=${status}` +
      `&limit=500&api_token=${token()}${cursor ? `&cursor=${cursor}` : ""}`;
    const json = await getJson(url);
    out.push(...((json.data || []) as V2Deal[]).map(normalizeV2));
    cursor = json.additional_data?.next_cursor || null;
    if (!cursor) break;
  }
  return out;
}

export async function fetchEventoDeals(): Promise<EventoDeal[]> {
  const [abertos, perdidos, ganhos] = await Promise.all([
    fetchAbertos(),
    fetchPorStatus("lost"),
    fetchPorStatus("won"),
  ]);
  return [...abertos, ...perdidos, ...ganhos];
}

/**
 * Nomes das etapas lidos ao vivo — o pipe 25 já teve uma etapa renomeada em
 * pleno evento (503) e fixar os rótulos no código faz o painel mentir no dia
 * seguinte. Fail-soft: se a chamada falhar, ficam os nomes conhecidos.
 */
export async function fetchStageNames(): Promise<Record<number, string>> {
  try {
    const json = await getJson(
      `${PIPEDRIVE_V1}/stages?pipeline_id=${PIPELINE_EVENTOS}&api_token=${token()}`
    );
    const nomes: Record<number, string> = { ...STAGE_NAMES };
    for (const s of (json.data || []) as { id: number; name: string }[]) {
      nomes[s.id] = s.name;
    }
    return nomes;
  } catch {
    return { ...STAGE_NAMES };
  }
}

/** Etapas onde o card para sem virar prospecção. */
export const ETAPAS_DE_PARADA: number[] = [STAGES.RELATORIO_REPROVADO, STAGES.EMAILS_REPROVADOS];

/** Notas de um card — usado só como fallback pros poucos cards sem log no Supabase. */
export async function fetchDealNotes(dealId: number): Promise<string[]> {
  try {
    const json = await getJson(
      `${PIPEDRIVE_V1}/notes?deal_id=${dealId}&limit=20&api_token=${token()}`
    );
    return (json.data || []).map((n: { content: string }) => n.content);
  } catch {
    return [];
  }
}

/**
 * Mesma fonte de `fetchDealNotes`, mas com `add_time` — usado só pela detecção
 * de falha de envio de e-mail (precisa saber QUANDO a falha aconteceu, não só
 * se aconteceu).
 */
export async function fetchDealNotesComData(
  dealId: number
): Promise<{ content: string; addTime: string }[]> {
  try {
    const json = await getJson(
      `${PIPEDRIVE_V1}/notes?deal_id=${dealId}&limit=50&api_token=${token()}`
    );
    return (json.data || []).map((n: { content: string; add_time: string }) => ({
      content: n.content,
      addTime: toIso(n.add_time) || n.add_time,
    }));
  } catch {
    return [];
  }
}
