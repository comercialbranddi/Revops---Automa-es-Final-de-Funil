import { NextResponse } from "next/server";
import {
  fetchAllEventoDeals,
  fetchDealNotes,
  origemLead,
  pipedriveCardUrl,
  relatorioLink,
  STAGES,
  STAGE_NAMES,
  LOST_REASON_CLIENTE_ATIVO,
  type PipedriveDeal,
} from "@/lib/pipedrive";

export const dynamic = "force-dynamic";

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function classifyReprovado(deal: PipedriveDeal, rawNotes: string[]): {
  motivo: string;
  detalhe: string;
} {
  if (deal.lost_reason === LOST_REASON_CLIENTE_ATIVO || deal.lost_reason === String(LOST_REASON_CLIENTE_ATIVO)) {
    return { motivo: "Cliente Branddi ativo", detalhe: "Já é cliente — marca já monitorada por nós, sem pescaria." };
  }

  const notes = rawNotes.map(stripHtml);
  const joined = notes.join(" \n ");

  if (/cliente ativo branddi|🛡️/i.test(joined)) {
    return { motivo: "Cliente Branddi ativo", detalhe: "Já é cliente — marca já monitorada por nós, sem pescaria." };
  }

  if (/contato inv[aá]lido|n[aã]o [ée] corporativo/i.test(joined)) {
    const m = joined.match(/e-?mail "([^"]+)"/i);
    return {
      motivo: "E-mail pessoal/inválido",
      detalhe: m ? `Domínio genérico: ${m[1]}` : "Contato sem e-mail corporativo válido.",
    };
  }

  if (/baixa[_-]captura[_-]finalizado/i.test(joined)) {
    return {
      motivo: "Baixa captura (retry esgotado)",
      detalhe: "Menos de 5 agressores mesmo após o retry — e-mail genérico já enviado.",
    };
  }

  const baixaCapturaMatch = joined.match(/relat[oó]rio reprovado\s*:\s*apenas (\d+) concorrente/i);
  if (baixaCapturaMatch) {
    const jaTeveRetry = /segunda \(e [úu]ltima\) monitoria/i.test(joined);
    return {
      motivo: jaTeveRetry ? "Baixa captura (após retry)" : "Baixa captura de agressores",
      detalhe: `Só ${baixaCapturaMatch[1]} concorrente(s) encontrado(s) — mínimo exigido é 5.${
        jaTeveRetry ? " Já passou pelo retry único permitido." : " Retry pode rodar automaticamente."
      }`,
    };
  }

  return { motivo: "Não classificado", detalhe: "Sem marcador reconhecido nas notas — checar manualmente." };
}

export async function GET() {
  try {
    const deals = await fetchAllEventoDeals();

    const porEstagio: Record<number, PipedriveDeal[]> = {};
    for (const deal of deals) {
      if (deal.status !== "open" && deal.stage_id !== STAGES.RELATORIO_REPROVADO) continue;
      (porEstagio[deal.stage_id] ||= []).push(deal);
    }

    const novos = [
      ...(porEstagio[STAGES.NOVO_LEAD] || []),
      ...(porEstagio[STAGES.MONITORIA] || []),
    ]
      .sort((a, b) => (a.add_time < b.add_time ? 1 : -1))
      .slice(0, 50)
      .map((d) => ({
        id: d.id,
        titulo: d.title,
        organizacao: d.org_name,
        estagio: STAGE_NAMES[d.stage_id] || String(d.stage_id),
        origem: origemLead(d),
        criadoEm: d.add_time,
        link: pipedriveCardUrl(d.id),
      }));

    const preCadastro = deals.filter((d) => origemLead(d) === "Pré-cadastro LinkedIn");
    const estande = deals.filter((d) => origemLead(d) === "Estande" || origemLead(d) === "QR Estande");

    const enviados = (porEstagio[STAGES.RELATORIO_ENVIADO] || [])
      .concat(porEstagio[STAGES.PROSPECCAO_ATIVA] || [])
      .concat(porEstagio[STAGES.SEM_RESPOSTA] || [])
      .concat(porEstagio[STAGES.RESPONDEU] || [])
      .map((d) => ({
        id: d.id,
        titulo: d.title,
        organizacao: d.org_name,
        estagio: STAGE_NAMES[d.stage_id] || String(d.stage_id),
        relatorio: relatorioLink(d),
        link: pipedriveCardUrl(d.id),
      }));

    const reprovadosBrutos = (porEstagio[STAGES.RELATORIO_REPROVADO] || []).slice(0, 60);
    const reprovados = await Promise.all(
      reprovadosBrutos.map(async (d) => {
        const notes = await fetchDealNotes(d.id);
        const { motivo, detalhe } = classifyReprovado(d, notes);
        return {
          id: d.id,
          titulo: d.title,
          organizacao: d.org_name,
          motivo,
          detalhe,
          link: pipedriveCardUrl(d.id),
        };
      })
    );

    const clientes = reprovados.filter((r) => r.motivo === "Cliente Branddi ativo");
    const errosOutros = reprovados.filter((r) => r.motivo !== "Cliente Branddi ativo");

    const numeros = {
      novoLead: (porEstagio[STAGES.NOVO_LEAD] || []).length,
      monitoria: (porEstagio[STAGES.MONITORIA] || []).length,
      relatorioReprovado: (porEstagio[STAGES.RELATORIO_REPROVADO] || []).length,
      relatorioEnviado: (porEstagio[STAGES.RELATORIO_ENVIADO] || []).length,
      prospeccaoAtiva: (porEstagio[STAGES.PROSPECCAO_ATIVA] || []).length,
      semResposta: (porEstagio[STAGES.SEM_RESPOSTA] || []).length,
      respondeu: (porEstagio[STAGES.RESPONDEU] || []).length,
      preCadastro: preCadastro.length,
      estande: estande.length,
    };

    return NextResponse.json({
      atualizadoEm: new Date().toISOString(),
      numeros,
      novos,
      enviados,
      reprovados,
      clientes,
      erros: errosOutros,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
