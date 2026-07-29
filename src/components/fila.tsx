"use client";

// Fila de recuperação do pré-cadastro (incidente 29/07/2026: orçamento diário
// de API do Pipedrive esgotado — leads da landing pararam de virar card).
// Leads que falham ficam salvos em `evento_pre_cadastro_falhas` e um cron na
// Lia os reenvia sozinho quando o Pipedrive volta. Esta seção mostra essa
// fila DENTRO do dash, pra Jessica não precisar de uma aba separada.
//
// Busca direto da view pública da edge function (?view=fila), a MESMA fonte
// da página avulsa https://formeventos.vercel.app/fila.html — de propósito:
// não passa pelo /api/eventos porque a fila precisa aparecer mesmo quando o
// Pipedrive está fora do ar (que é exatamente quando ela enche), e o e-mail
// já vem mascarado do servidor (endpoint sem autenticação).

import { useCallback, useEffect, useState } from "react";
import { Kpi } from "@/components/ui";

const FILA_URL =
  "https://rpqfxrmqsgiqzkroxemk.supabase.co/functions/v1/pre-ecomm-lead?view=fila";
const INTERVALO_MS = 60_000;

type StatusFila = "aguardando" | "reenviado" | "atencao";

interface LeadFila {
  quando: string;
  empresa: string | null;
  lead: string | null;
  email: string;
  member: string | null;
  status: StatusFila;
}

interface DadosFila {
  success: boolean;
  aguardando: number;
  reenviados: number;
  atencao: number;
  leads: LeadFila[];
}

const BADGE: Record<StatusFila, { rotulo: string; classe: string }> = {
  aguardando: { rotulo: "Aguardando", classe: "bg-amber-500/15 text-amber-300" },
  reenviado: { rotulo: "Reenviado ✓", classe: "bg-emerald-500/15 text-emerald-300" },
  atencao: { rotulo: "Precisa de atenção", classe: "bg-rose-500/15 text-rose-300" },
};

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function FilaPreCadastro() {
  const [dados, setDados] = useState<DadosFila | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${FILA_URL}&t=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as DadosFila;
      if (!json.success) throw new Error("resposta inválida da fila");
      setDados(json);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro desconhecido");
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [carregar]);

  if (erro) {
    return (
      <div className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">
        Não consegui ler a fila de recuperação: {erro}. A página avulsa continua em{" "}
        <a className="underline" href="https://formeventos.vercel.app/fila.html" target="_blank">
          formeventos.vercel.app/fila.html
        </a>
        .
      </div>
    );
  }

  if (!dados) return <p className="text-sm text-slate-500">Carregando fila…</p>;

  // No estado saudável (fila drenada) a lista some e sobra uma linha discreta —
  // a seção só cresce quando existe lead esperando, que é quando importa.
  const pendentes = dados.leads.filter((l) => l.status !== "reenviado");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi
          label="Aguardando"
          valor={dados.aguardando}
          nota="salvos, entram sozinhos quando o Pipedrive liberar"
          tom={dados.aguardando > 0 ? "atencao" : "ok"}
        />
        <Kpi
          label="Já reenviados"
          valor={dados.reenviados}
          nota="voltaram pro fluxo com ponto e sorteio"
          tom="ok"
        />
        <Kpi
          label="Precisam de atenção"
          valor={dados.atencao}
          nota="esgotaram as tentativas automáticas"
          tom={dados.atencao > 0 ? "critico" : "ok"}
        />
      </div>

      {pendentes.length === 0 ? (
        <p className="text-sm text-slate-500">
          Fila vazia — todo pré-cadastro que falhou já foi reenviado. 🎉
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          {pendentes.map((l, i) => (
            <div
              key={`${l.email}-${l.quando}-${i}`}
              className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/50 px-4 py-3 text-sm last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-200">{l.empresa ?? "—"}</div>
                <div className="truncate text-xs text-slate-500">
                  {l.lead ?? "—"} · {l.email}
                  {l.member ? ` · divulgado por ${l.member}` : ""}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[l.status].classe}`}
              >
                {BADGE[l.status].rotulo}
              </span>
              <span className="text-xs tabular-nums text-slate-500">
                {fmtHora.format(new Date(l.quando))}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600">
        Mesma fonte da página avulsa{" "}
        <a
          className="text-slate-500 underline"
          href="https://formeventos.vercel.app/fila.html"
          target="_blank"
        >
          formeventos.vercel.app/fila.html
        </a>{" "}
        — dá pra mandar aquele link pra equipe sem expor o resto do painel.
      </p>
    </div>
  );
}
