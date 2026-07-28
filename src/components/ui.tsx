import type { ReactNode } from "react";

export type Tom = "neutro" | "critico" | "atencao" | "ok" | "info";

export const TOM_TEXTO: Record<Tom, string> = {
  neutro: "text-slate-100",
  critico: "text-rose-400",
  atencao: "text-amber-400",
  ok: "text-emerald-400",
  info: "text-cyan-300",
};

export const TOM_PONTO: Record<Tom, string> = {
  neutro: "bg-slate-500",
  critico: "bg-rose-500",
  atencao: "bg-amber-500",
  ok: "bg-emerald-500",
  info: "bg-cyan-400",
};

export const TOM_BORDA: Record<Tom, string> = {
  neutro: "border-l-slate-600",
  critico: "border-l-rose-500",
  atencao: "border-l-amber-500",
  ok: "border-l-emerald-500",
  info: "border-l-cyan-400",
};

export function Kpi({
  label,
  valor,
  nota,
  tom = "neutro",
}: {
  label: string;
  valor: ReactNode;
  nota?: string;
  tom?: Tom;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${TOM_PONTO[tom]}`} />
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${TOM_TEXTO[tom]}`}>{valor}</div>
      {nota && <div className="mt-1 text-xs leading-snug text-slate-500">{nota}</div>}
    </div>
  );
}

export function Secao({
  titulo,
  subtitulo,
  acao,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-slate-100">{titulo}</h2>
          {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

export function Painel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/40 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Etiqueta({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  const cores: Record<Tom, string> = {
    neutro: "border-slate-700 bg-slate-800/60 text-slate-300",
    critico: "border-rose-900 bg-rose-950/50 text-rose-300",
    atencao: "border-amber-900 bg-amber-950/40 text-amber-300",
    ok: "border-emerald-900 bg-emerald-950/40 text-emerald-300",
    info: "border-cyan-900 bg-cyan-950/40 text-cyan-300",
  };
  // inline-block (e não inline-flex): rótulos longos como "E-mail pessoal
  // (domínio genérico)" precisam quebrar linha em tela estreita — um flex
  // container não quebra o texto e estoura a largura do card.
  return (
    <span
      className={`inline-block max-w-full rounded-full border px-2 py-0.5 text-[11px] font-medium ${cores[tom]}`}
    >
      {children}
    </span>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-900/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">{children}</tbody>
      </table>
    </div>
  );
}

export function Barra({
  rotulo,
  n,
  max,
  tom = "info",
  sufixo,
}: {
  rotulo: string;
  n: number;
  max: number;
  tom?: Tom;
  sufixo?: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((n / max) * 100)) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-slate-300">{rotulo}</span>
        <span className="shrink-0 tabular-nums text-slate-400">
          {n.toLocaleString("pt-BR")}
          {sufixo}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${TOM_PONTO[tom]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Sparkline em barras — sem dependência de lib de gráfico. */
export function Colunas({
  series,
  altura = 120,
}: {
  series: { rotulo: string; valores: { n: number; tom: Tom }[] }[];
  altura?: number;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.valores.map((v) => v.n)));
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-full items-end gap-[3px]" style={{ height: altura }}>
        {series.map((s, i) => (
          <div key={i} className="group relative flex flex-1 items-end justify-center gap-[2px]">
            {s.valores.map((v, j) => (
              <div
                key={j}
                className={`w-full rounded-t-sm ${TOM_PONTO[v.tom]} ${v.n === 0 ? "opacity-20" : "opacity-80"}`}
                style={{ height: `${Math.max(2, (v.n / max) * altura)}px` }}
              />
            ))}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 shadow-lg group-hover:block">
              {s.rotulo}: {s.valores.map((v) => v.n).join(" / ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pipedrive devolve UTC; o rótulo tem que sair no fuso de São Paulo, senão dá
 * 3h de diferença em tudo que o painel mostra.
 */
export function fmtData(raw: string, comAno = false) {
  return new Date(raw).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(comAno ? { year: "2-digit" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function fmtDuracao(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined) return "—";
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  if (h < 24) return `${h}h${minutos % 60 ? ` ${minutos % 60}min` : ""}`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
