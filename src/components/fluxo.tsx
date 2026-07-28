"use client";

import { useState } from "react";
import type { Alerta, CardAoVivo, CardResumo, EtapaFunil, EventosData, SerieHora } from "@/lib/tipos";
import {
  Barra,
  Colunas,
  Etiqueta,
  Painel,
  Tabela,
  TOM_BORDA,
  TOM_TEXTO,
  Vazio,
  fmtData,
  fmtDuracao,
  type Tom,
} from "./ui";

const NIVEL_TOM: Record<Alerta["nivel"], Tom> = {
  critico: "critico",
  atencao: "atencao",
  resolvido: "ok",
  info: "info",
};

const NIVEL_ROTULO: Record<Alerta["nivel"], string> = {
  critico: "CRÍTICO",
  atencao: "ATENÇÃO",
  resolvido: "RESOLVIDO",
  info: "CONTEXTO",
};

export function Alertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) {
    return <Vazio>Nada pedindo atenção agora — o fluxo está andando sozinho.</Vazio>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {alertas.map((a, i) => {
        const tom = NIVEL_TOM[a.nivel];
        return (
          <div
            key={i}
            className={`min-w-0 rounded-xl border border-slate-800 border-l-4 bg-slate-900/50 p-4 ${TOM_BORDA[tom]}`}
          >
            <Etiqueta tom={tom}>{NIVEL_ROTULO[a.nivel]}</Etiqueta>
            <h3 className="mt-2.5 font-semibold text-slate-100">{a.titulo}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
              {a.valor && <span className={`font-semibold ${TOM_TEXTO[tom]}`}>{a.valor} </span>}
              {a.texto}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function Funil({
  funil,
  saidaLateral,
  origens,
  legado,
}: {
  funil: EtapaFunil[];
  saidaLateral: EventosData["saidaLateral"];
  origens: EventosData["origens"];
  legado: EventosData["legado"];
}) {
  const maxSaida = Math.max(1, ...saidaLateral.map((s) => s.n));
  const maxOrigem = Math.max(1, ...origens.map((o) => o.n));

  return (
    <Painel>
      <div className="flex flex-wrap items-stretch gap-2">
        {funil.map((etapa, i) => (
          <div key={etapa.stageId} className="flex flex-1 items-center gap-2">
            <div className="min-w-[128px] flex-1 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {etapa.nome}
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-100">
                {etapa.abertos}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                {etapa.travados > 0 && (
                  <span className="text-rose-400">{etapa.travados} travado(s)</span>
                )}
                {etapa.perdidos > 0 && (
                  <span className="text-slate-500">{etapa.perdidos} perdido(s)</span>
                )}
                {etapa.ganhos > 0 && <span className="text-emerald-400">{etapa.ganhos} ganho(s)</span>}
                {etapa.abertos === 0 && etapa.perdidos === 0 && etapa.ganhos === 0 && (
                  <span className="text-slate-600">vazio</span>
                )}
              </div>
            </div>
            {i < funil.length - 1 && <span className="shrink-0 text-slate-700">→</span>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-slate-300">Saída lateral — por que o card parou</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Cards marcados como Perdido no período, agrupados pelo motivo real.
          </p>
          <div className="mt-3 space-y-2.5">
            {saidaLateral.length === 0 && (
              <p className="text-sm text-slate-600">Nenhum card perdido no período.</p>
            )}
            {saidaLateral.slice(0, 8).map((s) => (
              <Barra
                key={s.chave}
                rotulo={s.rotulo}
                n={s.n}
                max={maxSaida}
                tom={s.severidade === "erro" ? "critico" : s.severidade === "atencao" ? "atencao" : "neutro"}
              />
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-slate-300">Por onde o lead entrou</h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Pré-cadastro sobe antes do evento; estande e QR sobem ao vivo, no balcão.
          </p>
          <div className="mt-3 space-y-2.5">
            {origens.map((o) => (
              <Barra key={o.chave} rotulo={o.rotulo} n={o.n} max={maxOrigem} tom="info" />
            ))}
          </div>
        </div>
      </div>

      {(legado.abertos > 0 || legado.perdidos > 0) && (
        <p className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
          Fora do funil acima: <strong className="text-slate-400">{legado.abertos}</strong> abertos e{" "}
          <strong className="text-slate-400">{legado.perdidos}</strong> perdidos no estágio{" "}
          <em>Evento Antigo</em> — cards do evento anterior, mantidos só como histórico.
        </p>
      )}
    </Painel>
  );
}

export function MovimentoPorHora({ porHora }: { porHora: SerieHora[] }) {
  const series = porHora.map((h) => ({
    rotulo: h.hora,
    valores: [
      { n: h.criados, tom: "info" as Tom },
      { n: h.concluidos, tom: "ok" as Tom },
      { n: h.reprovados, tom: "critico" as Tom },
    ],
  }));
  const total = porHora.reduce(
    (acc, h) => ({
      criados: acc.criados + h.criados,
      concluidos: acc.concluidos + h.concluidos,
      reprovados: acc.reprovados + h.reprovados,
    }),
    { criados: 0, concluidos: 0, reprovados: 0 }
  );

  return (
    <Painel>
      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-cyan-400" /> entraram ({total.criados})
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> seguiram pro relatório ({total.concluidos})
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-rose-500" /> reprovados ({total.reprovados})
        </span>
      </div>
      <Colunas series={series} />
      <div className="mt-2 flex justify-between text-[10px] text-slate-600">
        <span>{porHora[0]?.hora}</span>
        <span>{porHora[porHora.length - 1]?.hora}</span>
      </div>
    </Painel>
  );
}

const ICONE: Record<string, string> = {
  done: "✓",
  run: "▸",
  info: "·",
  wait: "⏳",
  error: "✕",
};

export function AoVivo({ cards, supabaseOk }: { cards: CardAoVivo[]; supabaseOk: boolean }) {
  const [aberto, setAberto] = useState<number | null>(null);

  if (!supabaseOk) {
    return (
      <Vazio>
        O fluxo ao vivo lê <code className="text-slate-400">deal_processing_logs</code> no Supabase da Lia.
        Configure <code className="text-slate-400">SUPABASE_URL</code> e{" "}
        <code className="text-slate-400">SUPABASE_SERVICE_ROLE_KEY</code> pra ligar esta seção.
      </Vazio>
    );
  }
  if (!cards.length) {
    return <Vazio>Nenhum card em processamento agora — a fila está limpa.</Vazio>;
  }

  return (
    <div className="space-y-2">
      {cards.map((c) => {
        const tom: Tom =
          c.statusLog === "error" ? "critico" : c.statusLog === "waiting" ? "atencao" : "info";
        const expandido = aberto === c.id;
        return (
          <div key={c.id} className={`rounded-xl border border-slate-800 border-l-4 bg-slate-900/40 ${TOM_BORDA[tom]}`}>
            <button
              onClick={() => setAberto(expandido ? null : c.id)}
              className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-slate-800/30"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-100">{c.org}</span>
                  <Etiqueta tom={tom}>{c.statusLog}</Etiqueta>
                  <span className="text-xs text-slate-500">{c.estagio}</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-400">
                  <span className={TOM_TEXTO[tom]}>{ICONE[c.ultimoPassoIcon] || "·"}</span> {c.ultimoPasso}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <div>há {fmtDuracao(c.atualizadoHaMin)}</div>
                <div className="mt-0.5">rodando {fmtDuracao(c.duracaoMin)}</div>
              </div>
            </button>
            {expandido && (
              <div className="border-t border-slate-800 px-4 py-3">
                <ol className="space-y-1.5">
                  {c.passos.map((p, i) => (
                    <li key={i} className="flex gap-3 text-xs">
                      <span className="shrink-0 tabular-nums text-slate-600">{p.time}</span>
                      <span className="shrink-0 text-slate-500">{ICONE[p.icon] || "·"}</span>
                      <span className="text-slate-300">{p.msg}</span>
                    </li>
                  ))}
                </ol>
                <a
                  href={c.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-cyan-400 hover:underline"
                >
                  Abrir card no Pipedrive →
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Novos({ cards }: { cards: CardResumo[] }) {
  if (!cards.length) return <Vazio>Nenhum card novo no período selecionado.</Vazio>;
  return (
    <Tabela cabecalho={["Organização", "Origem", "Etapa atual", "Parado há", "Score", "Situação", ""]}>
      {cards.map((c) => (
        <tr key={c.id} className="bg-slate-950/30">
          <td className="px-4 py-2.5">
            <div className="font-medium text-slate-200">{c.org}</div>
            <div className="text-[11px] text-slate-500">criado {fmtData(c.criadoEm)}</div>
          </td>
          <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{c.origem}</td>
          <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{c.estagio}</td>
          <td
            className={`whitespace-nowrap px-4 py-2.5 tabular-nums ${
              (c.naEtapaHaMin ?? 0) > 15 && c.stageId === 501 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            {fmtDuracao(c.naEtapaHaMin)}
          </td>
          <td className="px-4 py-2.5 tabular-nums text-slate-400">{c.companyScore ?? "—"}</td>
          <td className="px-4 py-2.5">
            <Etiqueta
              tom={
                c.severidade === "erro"
                  ? "critico"
                  : c.severidade === "atencao"
                    ? "atencao"
                    : c.severidade === "ok"
                      ? "ok"
                      : "neutro"
              }
            >
              {c.motivo}
            </Etiqueta>
          </td>
          <td className="whitespace-nowrap px-4 py-2.5">
            <a href={c.link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
              Ver →
            </a>
          </td>
        </tr>
      ))}
    </Tabela>
  );
}
