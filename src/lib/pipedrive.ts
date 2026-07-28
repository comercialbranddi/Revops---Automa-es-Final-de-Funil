const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";
const PIPELINE_EVENTOS = 25;

export const STAGES = {
  NOVO_LEAD: 315,
  MONITORIA: 501,
  RELATORIO_REPROVADO: 502,
  RELATORIO_ENVIADO: 503,
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
  503: "Relatório Enviado",
  504: "Prospecção Ativa",
  505: "Sem resposta",
  506: "Respondeu",
  319: "Reunião Agendada",
  401: "Reunião Realizada",
  500: "Evento Antigo",
};

export const LOST_REASON_CLIENTE_ATIVO = 1582;

const FIELD = {
  RELATORIO_HTML: "d9a9920ec8517f9603a121ba48f0a6af87e455f3",
  ORIGEM_DO_LEAD: "0c60a8179f542f1c7b0846a6c16e476b0ffece52",
  COMPANY_SCORE: "dc70ae6a9f2b53c6940c30170fa209c3d4f2677b",
} as const;

export const ORIGEM_LEAD_OPTIONS: Record<number, string> = {
  1551: "Estande",
  1552: "Pré-cadastro LinkedIn",
  1580: "QR Estande",
  1581: "Monitoria VC / Buy Box",
};

export interface PipedriveDeal {
  id: number;
  title: string;
  org_name: string | null;
  person_name: string | null;
  stage_id: number;
  status: "open" | "won" | "lost";
  add_time: string;
  update_time: string;
  lost_reason: string | number | null;
  [FIELD.RELATORIO_HTML]: string | null;
  [FIELD.ORIGEM_DO_LEAD]: number | null;
  [FIELD.COMPANY_SCORE]: number | null;
}

export function pipedriveCardUrl(dealId: number): string {
  return `https://app.pipedrive.com/deal/${dealId}`;
}

export function relatorioLink(deal: PipedriveDeal): string | null {
  return deal[FIELD.RELATORIO_HTML] || null;
}

export function origemLead(deal: PipedriveDeal): string {
  const id = deal[FIELD.ORIGEM_DO_LEAD];
  if (!id) return "Desconhecida";
  return ORIGEM_LEAD_OPTIONS[id] || "Desconhecida";
}

export async function fetchAllEventoDeals(): Promise<PipedriveDeal[]> {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) {
    throw new Error("PIPEDRIVE_API_TOKEN não configurado");
  }

  const deals: PipedriveDeal[] = [];
  let start = 0;
  const limit = 500;

  while (true) {
    const url = `${PIPEDRIVE_BASE}/pipelines/${PIPELINE_EVENTOS}/deals?start=${start}&limit=${limit}&status=all_not_deleted&api_token=${token}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Pipedrive respondeu ${res.status}`);
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Erro desconhecido na API do Pipedrive");
    }
    deals.push(...(json.data || []));

    const pagination = json.additional_data?.pagination;
    if (!pagination?.more_items_in_collection) break;
    start = pagination.next_start;
  }

  return deals;
}

export async function fetchDealNotes(dealId: number): Promise<string[]> {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  const url = `${PIPEDRIVE_BASE}/notes?deal_id=${dealId}&api_token=${token}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  if (!json.success) return [];
  return (json.data || []).map((n: { content: string }) => n.content);
}
