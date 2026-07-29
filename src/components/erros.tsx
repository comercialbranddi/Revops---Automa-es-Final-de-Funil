"use client";

import { useState } from "react";
import type { CardResumo, Contagem, ErroItem, EventosData } from "@/lib/tipos";
import {
  Barra,
  Etiqueta,
  Painel,
  Tabela,
  TOM_BORDA,
  Vazio,
  fmtData,
  fmtDuracao,
  type Tom,
} from "./ui";

type Aba = "abertos" | "resolvidos" | "tipos";

export function Erros({
  erros,
  supabaseOk,
}: {
  erros: EventosData["erros"];
  supabaseOk: boolean;
}) {
  const [aba, setAba] = useState<Aba>("abertos");

  if (!supabaseOk) {
    return (
      <Vazio>
        Erros técnicos vêm de <code className="text-slate-400">automation_errors</code> no Supabase da Lia —
        é a mesma tabela que alimenta o digest diário por e-mail. Falta a credencial pra ligar.
      </Vazio>
    );
  }

  const abas: { chave: Aba; rotulo: string; n: number }[] = [
    { chave: "abertos", rotulo: "Abertos", n: erros.abertos.length },
    { chave: "resolvidos", rotulo: "Resolvidos", n: erros.resolvidos.length },
    { chave: "tipos", rotulo: "Por tipo", n: erros.porTipo.length },
  ];
  const maxTipo = Math.max(1, ...erros.porTipo.map((t) => t.n));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {abas.map((a) => (
          <button
            key={a.chave}
            onClick={() => setAba(a.chave)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              aba === a.chave
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                : "border-slate-700 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {a.rotulo} ({a.n})
          </button>
        ))}
        {erros.medianaResolucaoMin !== null && (
          <span className="ml-auto text-xs text-slate-500">
            Mediana até resolver: <strong className="text-slate-300">{fmtDuracao(erros.medianaResolucaoMin)}</strong>
          </span>
        )}
      </div>

      {aba === "tipos" && (
        <Painel>
          <div className="space-y-3">
            {erros.porTipo.length === 0 && <p className="text-sm text-slate-600">Nenhum erro registrado.</p>}
            {erros.porTipo.map((t) => (
              <Barra key={t.chave} rotulo={t.rotulo} n={t.n} max={maxTipo} tom="critico" />
            ))}
          </div>
        </Painel>
      )}

      {aba !== "tipos" && (
        <ListaErros
          itens={aba === "abertos" ? erros.abertos : erros.resolvidos}
          resolvidos={aba === "resolvidos"}
        />
      )}
    </>
  );
}

function ListaErros({ itens, resolvidos }: { itens: ErroItem[]; resolvidos: boolean }) {
  if (!itens.length) {
    return (
      <Vazio>
        {resolvidos
          ? "Nenhum erro resolvido registrado no período."
          : "Nenhum erro técnico aberto — todo card que falhou já voltou a andar."}
      </Vazio>
    );
  }
  return (
    <Tabela
      cabecalho={[
        "Organização",
        "Etapa",
        "Tipo",
        "Detalhe",
        "Tentativas",
        resolvidos ? "Levou" : "Aberto há",
        "",
      ]}
    >
      {itens.map((e) => (
        <tr key={e.id} className="bg-slate-950/30">
          <td className="px-4 py-2.5">
            <div className="font-medium text-slate-200">{e.org}</div>
            <div className="text-[11px] text-slate-500">{fmtData(e.ocorridoEm)}</div>
          </td>
          <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{e.stage}</td>
          <td className="whitespace-nowrap px-4 py-2.5">
            <code className={`text-xs ${resolvidos ? "text-emerald-300" : "text-rose-300"}`}>{e.tipo}</code>
          </td>
          <td className="max-w-md px-4 py-2.5 text-slate-400">{e.detalhe || "—"}</td>
          <td className="px-4 py-2.5 tabular-nums text-slate-400">{e.retries}</td>
          <td
            className={`whitespace-nowrap px-4 py-2.5 tabular-nums ${
              resolvidos ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {fmtDuracao(e.minutosAberto)}
          </td>
          <td className="whitespace-nowrap px-4 py-2.5">
            <a href={e.link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
              Ver →
            </a>
          </td>
        </tr>
      ))}
    </Tabela>
  );
}

const SEV_TOM: Record<string, Tom> = {
  erro: "critico",
  atencao: "atencao",
  descarte: "neutro",
  ok: "ok",
};

export function Reprovados({
  cards,
  porMotivo,
}: {
  cards: CardResumo[];
  porMotivo: Contagem[];
}) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const filtrados = motivo ? cards.filter((c) => c.motivoChave === motivo) : cards;

  if (!cards.length) return <Vazio>Nenhum card em Relatório Reprovado no período.</Vazio>;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setMotivo(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            motivo === null
              ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
              : "border-slate-700 text-slate-400 hover:bg-slate-800"
          }`}
        >
          Todos ({cards.length})
        </button>
        {porMotivo.map((m) => (
          <button
            key={m.chave}
            onClick={() => setMotivo(m.chave)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              motivo === m.chave
                ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                : "border-slate-700 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {m.rotulo} ({m.n})
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtrados.map((c) => {
          const tom = SEV_TOM[c.severidade] || "neutro";
          return (
            <div
              key={c.id}
              className={`min-w-0 rounded-xl border border-slate-800 border-l-4 bg-slate-900/40 p-4 ${TOM_BORDA[tom]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-100">{c.org}</div>
                  <div className="mt-1.5">
                    <Etiqueta tom={tom}>{c.motivo}</Etiqueta>
                  </div>
                </div>
                <a
                  href={c.link}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-cyan-400 hover:underline"
                >
                  Ver →
                </a>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.detalhe}</p>
              <p className="mt-2 text-[11px] text-slate-600">
                {c.origem} · parado há {fmtDuracao(c.naEtapaHaMin)}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Clientes({ cards }: { cards: CardResumo[] }) {
  if (!cards.length) return <Vazio>Nenhum cliente ativo identificado no período.</Vazio>;
  return (
    <Tabela cabecalho={["Organização", "Origem", "Status do card", "Entrou em", ""]}>
      {cards.map((c) => (
        <tr key={c.id} className="bg-slate-950/30">
          <td className="px-4 py-2.5 font-medium text-slate-200">{c.org}</td>
          <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{c.origem}</td>
          <td className="whitespace-nowrap px-4 py-2.5">
            <Etiqueta tom={c.status === "lost" ? "neutro" : "atencao"}>
              {c.status === "lost" ? "Perdido (esperado)" : `Aberto em ${c.estagio}`}
            </Etiqueta>
          </td>
          <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{fmtData(c.criadoEm)}</td>
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

export function Relatorios({ cards }: { cards: CardResumo[] }) {
  if (!cards.length) return <Vazio>Nenhum relatório gerado no período.</Vazio>;
  return (
    <Tabela cabecalho={["Organização", "Etapa", "E-mail validado", "Relatório", ""]}>
      {cards.map((c) => (
        <tr key={c.id} className="bg-slate-950/30">
          <td className="px-4 py-2.5 font-medium text-slate-200">{c.org}</td>
          <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{c.estagio}</td>
          <td className="whitespace-nowrap px-4 py-2.5">
            {c.emailValidado ? (
              <Etiqueta tom={c.emailValidado === "Sim" ? "ok" : "atencao"}>{c.emailValidado}</Etiqueta>
            ) : (
              <span className="text-slate-600">—</span>
            )}
          </td>
          <td className="px-4 py-2.5">
            {c.relatorio ? (
              <a
                href={c.relatorio}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline"
              >
                Abrir relatório →
              </a>
            ) : (
              <span className="text-slate-600">enviado, sem link no card</span>
            )}
          </td>
          <td className="whitespace-nowrap px-4 py-2.5">
            <a href={c.link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
              Card →
            </a>
          </td>
        </tr>
      ))}
    </Tabela>
  );
}

export function Placar({ placar }: { placar: EventosData["placar"] }) {
  if (!placar.disponivel) {
    return (
      <Vazio>
        O placar vive em <code className="text-slate-400">evento_placar_pontos</code> no Supabase da Lia.
        Falta a credencial.
      </Vazio>
    );
  }
  if (!placar.ranking.length) {
    return <Vazio>Nenhum ponto registrado no período.</Vazio>;
  }
  return (
    <Painel>
      <div className="mb-3 flex items-baseline justify-between">
        <h4 className="text-sm font-medium text-slate-300">Ranking da equipe</h4>
        <span className="text-xs text-slate-500">
          {placar.total.toLocaleString("pt-BR")} pontos no total
        </span>
      </div>
      <ol className="space-y-2">
        {placar.ranking.map((r, i) => (
          <li
            key={r.pessoa}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-950/40 px-3 py-2"
          >
            <span className="flex items-center gap-3">
              <span className="w-5 text-right tabular-nums text-slate-600">{i + 1}</span>
              <span className="font-medium text-slate-200">{r.pessoa}</span>
            </span>
            <span className="flex items-center gap-4 text-xs text-slate-500">
              <span>{r.leads} leads</span>
              <span>{r.reunioes} reuniões</span>
              <span>{r.contratos} contratos</span>
              <strong className="w-14 text-right text-base tabular-nums text-cyan-300">{r.pontos}</strong>
            </span>
          </li>
        ))}
      </ol>
    </Painel>
  );
}
