"use client";

import { useEffect, useState } from "react";

type Numeros = {
  novoLead: number;
  monitoria: number;
  relatorioReprovado: number;
  relatorioEnviado: number;
  prospeccaoAtiva: number;
  semResposta: number;
  respondeu: number;
  preCadastro: number;
  estande: number;
};

type Novo = {
  id: number;
  titulo: string;
  organizacao: string | null;
  estagio: string;
  origem: string;
  criadoEm: string;
  link: string;
};

type Enviado = {
  id: number;
  titulo: string;
  organizacao: string | null;
  estagio: string;
  relatorio: string | null;
  link: string;
};

type Reprovado = {
  id: number;
  titulo: string;
  organizacao: string | null;
  motivo: string;
  detalhe: string;
  link: string;
};

type EventosData = {
  atualizadoEm: string;
  numeros: Numeros;
  novos: Novo[];
  enviados: Enviado[];
  reprovados: Reprovado[];
  clientes: Reprovado[];
  erros: Reprovado[];
};

function Card({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClass = {
    default: "text-slate-100",
    danger: "text-red-400",
    warning: "text-amber-400",
    success: "text-emerald-400",
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// Pipedrive retorna add_time/update_time como "YYYY-MM-DD HH:MM:SS" em UTC,
// sem marcador de timezone — sem o "Z", o JS trataria como horário local do
// navegador/servidor, o que fica errado (~3h adiantado em relação ao BRT).
function fmtData(raw: string) {
  const iso = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function Home() {
  const [data, setData] = useState<EventosData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/eventos", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao carregar dados");
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="text-xs font-medium tracking-wide text-cyan-400">
          BRANDDI · REVOPS · OBSERVABILIDADE
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-50">
          Funil de Eventos, ponta a ponta e ao vivo
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Pipeline &quot;7. Eventos&quot; no Pipedrive — leads que sobem via pré-cadastro
          e estande, passam por monitoria de marca, relatório competitivo e
          prospecção. Este painel mostra o que está entrando, o que travou e o
          que precisa de revisão.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Pipedrive ao vivo
          </span>
          {data && <span>Atualizado {fmtData(data.atualizadoEm)}</span>}
          <button
            onClick={load}
            className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
          >
            Atualizar agora
          </button>
        </div>
      </div>

      {loading && <p className="mt-6 text-slate-400">Carregando dados do Pipedrive…</p>}
      {error && (
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
          Erro ao carregar: {error}
        </div>
      )}

      {data && (
        <>
          <Section title="Números do dia">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Card label="Novo lead" value={data.numeros.novoLead} />
              <Card label="Em monitoria" value={data.numeros.monitoria} />
              <Card label="Relatório reprovado" value={data.numeros.relatorioReprovado} tone="danger" />
              <Card label="Relatório enviado" value={data.numeros.relatorioEnviado} tone="success" />
              <Card label="Prospecção ativa" value={data.numeros.prospeccaoAtiva} />
            </div>
          </Section>

          <Section
            title="Pré-cadastro vs. Estande (standby)"
            subtitle="Quem subiu antes do evento (pré-cadastro) vs. quem está subindo agora, ao vivo, no estande."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card label="Pré-cadastro" value={data.numeros.preCadastro} />
              <Card label="Estande (standby)" value={data.numeros.estande} />
              <Card label="Sem resposta" value={data.numeros.semResposta} />
              <Card label="Respondeu" value={data.numeros.respondeu} tone="success" />
            </div>
          </Section>

          <Section
            title="Novos para avaliar"
            subtitle="Leads recém-chegados (Novo Lead / Monitoria) — clique no link pra abrir o card e conferir."
          >
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Organização</th>
                    <th className="px-4 py-2">Estágio</th>
                    <th className="px-4 py-2">Origem</th>
                    <th className="px-4 py-2">Criado em</th>
                    <th className="px-4 py-2">Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.novos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-slate-500">
                        Nenhum lead novo no momento.
                      </td>
                    </tr>
                  )}
                  {data.novos.map((n) => (
                    <tr key={n.id} className="bg-slate-950/40">
                      <td className="px-4 py-2 text-slate-200">{n.organizacao || n.titulo}</td>
                      <td className="px-4 py-2 text-slate-400">{n.estagio}</td>
                      <td className="px-4 py-2 text-slate-400">{n.origem}</td>
                      <td className="px-4 py-2 text-slate-400">{fmtData(n.criadoEm)}</td>
                      <td className="px-4 py-2">
                        <a
                          href={n.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline"
                        >
                          Verificar →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Erros — Relatório Reprovado, o motivo"
            subtitle="Cards que travaram antes de virar prospecção ativa (exclui clientes, que têm seção própria abaixo), com o motivo classificado a partir das notas do card."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {data.erros.length === 0 && (
                <p className="text-slate-500">Nenhum erro em aberto.</p>
              )}
              {data.erros.map((r) => (
                <div key={r.id} className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-100">{r.organizacao || r.titulo}</div>
                      <div className="mt-1 text-xs font-semibold uppercase text-amber-400">{r.motivo}</div>
                      <p className="mt-1 text-sm text-slate-400">{r.detalhe}</p>
                    </div>
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-cyan-400 hover:underline"
                    >
                      Ver card →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Quais são clientes"
            subtitle="Já são clientes Branddi ativos — não geram pescaria/relatório competitivo, só e-mail de sorteio."
          >
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Organização</th>
                    <th className="px-4 py-2">Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.clientes.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-slate-500">
                        Nenhum cliente identificado em Relatório Reprovado no momento.
                      </td>
                    </tr>
                  )}
                  {data.clientes.map((c) => (
                    <tr key={c.id} className="bg-slate-950/40">
                      <td className="px-4 py-2 text-slate-200">{c.organizacao || c.titulo}</td>
                      <td className="px-4 py-2">
                        <a href={c.link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                          Ver card →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Relatórios enviados — link"
            subtitle="Dados da monitoria e link do relatório de cada organização que já passou por Monitoria."
          >
            <div className="overflow-hidden rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/80 text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Organização</th>
                    <th className="px-4 py-2">Estágio</th>
                    <th className="px-4 py-2">Relatório</th>
                    <th className="px-4 py-2">Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.enviados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-slate-500">
                        Nenhum relatório enviado ainda.
                      </td>
                    </tr>
                  )}
                  {data.enviados.map((e) => (
                    <tr key={e.id} className="bg-slate-950/40">
                      <td className="px-4 py-2 text-slate-200">{e.organizacao || e.titulo}</td>
                      <td className="px-4 py-2 text-slate-400">{e.estagio}</td>
                      <td className="px-4 py-2">
                        {e.relatorio ? (
                          <a href={e.relatorio} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                            Abrir relatório →
                          </a>
                        ) : (
                          <span className="text-slate-600">sem link</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <a href={e.link} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                          Card →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Visão de pontos"
            subtitle="Placar da equipe de vendas (lead capturado / reunião agendada / contrato fechado) e sorteio do iPhone para leads."
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
              O placar de pontos e o sorteio ainda vivem no dashboard público{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">formoff/placar.html</code>{" "}
              (dados no Supabase do repo <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-200">Lia</code>).
              Pra trazer o ranking pra dentro deste painel falta só a credencial do Supabase — me
              passa a URL/service key do projeto quando quiser que eu integre aqui.
            </div>
          </Section>
        </>
      )}
    </main>
  );
}
