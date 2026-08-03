/**
 * Placar pela Edge Function pública `formoff-pipedrive` — a mesma fonte que o
 * `formoff/placar.html` já usa. Não pede credencial nenhuma, então o ranking
 * funciona mesmo sem a SERVICE_ROLE_KEY do Supabase.
 *
 * Diferença importante em relação a ler `evento_placar_pontos` direto: aqui vem
 * só o TOTAL de pontos por pessoa, sem a quebra por motivo (lead / reunião /
 * contrato). A quebra continua vindo do Supabase quando a credencial existe.
 */

const EDGE_FUNCTION_URL =
  process.env.EVENTO_PLACAR_URL ||
  "https://rpqfxrmqsgiqzkroxemk.supabase.co/functions/v1/formoff-pipedrive";

export type PlacarPublico = {
  totalLeads: number;
  pontosPorPessoa: Record<string, number>;
};

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Edge function respondeu ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

export async function fetchPlacarPublico(): Promise<PlacarPublico> {
  const json = await getJson(EDGE_FUNCTION_URL);
  const membros = (json.members || {}) as Record<string, { count?: number }>;
  const pontosPorPessoa: Record<string, number> = {};
  for (const [nome, dados] of Object.entries(membros)) {
    pontosPorPessoa[nome] = Number(dados?.count ?? 0);
  }
  return { totalLeads: Number(json.totalSynced ?? 0), pontosPorPessoa };
}

