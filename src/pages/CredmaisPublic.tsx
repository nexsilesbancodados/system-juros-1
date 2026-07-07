import type { ElementType, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  HandCoins,
  Landmark,
  LineChart,
  Mail,
  MapPin,
  Menu,
  Phone,
  ReceiptText,
  ShieldCheck,
  Workflow,
} from "lucide-react";

type Solution = {
  slug: string;
  title: string;
  headline: string;
  detail: string;
  icon: ElementType;
  bullets: string[];
  metric: string;
};

const solutions: Solution[] = [
  {
    slug: "antecipacao-de-recebiveis",
    title: "Antecipação de Recebíveis",
    headline: "Transforme vendas a prazo em caixa hoje.",
    detail: "A Credmais estrutura a compra de recebíveis comerciais com análise objetiva, documentação clara e pagamento ágil, ajudando sua empresa a financiar crescimento com o que já vendeu.",
    icon: HandCoins,
    bullets: ["Crédito sem alongar dívida bancária", "Análise de duplicatas, boletos e contratos", "Processo desenhado para recorrência"],
    metric: "Caixa no curto prazo",
  },
  {
    slug: "boleto-garantido",
    title: "Boleto Garantido",
    headline: "Recebimento garantido, sem risco de inadimplência.",
    detail: "A solução protege o recebimento da sua operação e simplifica a gestão de risco, para que sua equipe comercial possa vender com mais segurança.",
    icon: ReceiptText,
    bullets: ["Redução de exposição ao risco", "Conciliação mais simples", "Mais confiança para vender a prazo"],
    metric: "Mais segurança nas vendas",
  },
  {
    slug: "consultoria",
    title: "Consultoria",
    headline: "Estruturação financeira sob medida.",
    detail: "A Credmais avalia contratos, recebíveis, prazos, garantias e rotina financeira para montar uma estratégia aderente ao seu negócio.",
    icon: LineChart,
    bullets: ["Mapeamento de fluxo de caixa", "Estratégia de capital de giro", "Apoio em estruturação de crédito"],
    metric: "Decisão com dados",
  },
  {
    slug: "crediario",
    title: "Crediário",
    headline: "Ofereça parcelamento ao seu cliente final.",
    detail: "A solução de crediário Credmais conecta sua venda ao financiamento do cliente final com análise, documentação e acompanhamento.",
    icon: CircleDollarSign,
    bullets: ["Parcelamento para vender mais", "Jornada simples para o cliente", "Acompanhamento de carteira"],
    metric: "Mais conversão comercial",
  },
  {
    slug: "gestao-de-contas",
    title: "Gestão de Contas",
    headline: "Controle e conciliação do seu fluxo.",
    detail: "A Credmais apoia o controle operacional de contas, conciliações e previsões para reduzir ruído e melhorar a tomada de decisão.",
    icon: Workflow,
    bullets: ["Rotina financeira organizada", "Conciliação de recebíveis", "Visão clara de entradas e saídas"],
    metric: "Fluxo sob controle",
  },
];

const processSteps = [
  { title: "Diagnóstico", text: "Entendemos sua operação, prazos, carteira de clientes e necessidade de caixa.", icon: FileCheck2 },
  { title: "Estruturação", text: "Montamos a alternativa mais adequada entre antecipação, garantia, crediário ou gestão.", icon: Landmark },
  { title: "Execução", text: "Formalizamos a operação, acompanhamos indicadores e mantemos o fluxo em movimento.", icon: CalendarCheck },
];

export function CredmaisHome() {
  return (
    <PublicShell>
      <Hero />
      <StatsBand />
      <SolutionsSection />
      <ProcessSection />
      <CredibilitySection />
      <ContactCta />
    </PublicShell>
  );
}

export function CredmaisSolutionPage() {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\/+/, "");
  const solution = solutions.find((item) => item.slug === slug) ?? solutions[0];
  const Icon = solution.icon;

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-[#16211D] px-5 py-20 text-white md:px-8 md:py-28">
        <FinancialVisual />
        <div className="relative z-10 mx-auto max-w-7xl">
          <Link to="/#solucoes" className="mb-10 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-[#D8A941]">
            <ArrowRight className="h-4 w-4 rotate-180" /> Soluções
          </Link>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_0.7fr] lg:items-end">
            <div>
              <span className="mb-6 grid h-16 w-16 place-items-center rounded-lg bg-[#D8A941] text-[#16211D]"><Icon className="h-8 w-8" /></span>
              <h1 className="text-5xl font-black uppercase leading-[0.95] md:text-7xl">{solution.title}</h1>
              <p className="mt-6 max-w-2xl text-2xl font-light leading-relaxed text-white/75">{solution.headline}</p>
            </div>
            <div className="rounded-lg border border-white/12 bg-white/10 p-6 backdrop-blur">
              <p className="text-lg leading-relaxed text-white/75">{solution.detail}</p>
              <Link to="/contato" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#D8A941] px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#16211D]">
                Solicitar conversa <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-[#F7F4EC] px-5 py-20 text-[#16211D] md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B96942]">Aplicação</p>
            <h2 className="mt-4 text-4xl font-black uppercase leading-none md:text-6xl">Quando essa solução faz sentido.</h2>
          </div>
          <div className="grid gap-4">
            {solution.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-4 rounded-lg border border-[#16211D]/10 bg-white p-5 shadow-sm">
                <CheckCircle2 className="mt-1 h-6 w-6 flex-none text-[#0D5E45]" />
                <span className="text-xl font-medium">{bullet}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ContactCta />
    </PublicShell>
  );
}

export function CredmaisAboutPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Sobre"
        title="A Credmais aproxima empresas de capital, segurança e gestão."
        text="Somos uma securitizadora focada em estruturar soluções financeiras para empresas que vendem a prazo, trabalham com recebíveis e precisam transformar fluxo em decisão."
      />
      <section className="bg-[#F7F4EC] px-5 py-20 text-[#16211D] md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
          {[
            ["Pragmatismo", "Operações desenhadas para resolver necessidade real de caixa, venda ou controle."],
            ["Transparência", "Documentação, etapas e critérios explicados com clareza desde o primeiro contato."],
            ["Parceria", "Acompanhamento contínuo para ajustar soluções ao momento da empresa."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-lg border border-[#16211D]/10 bg-white p-7 shadow-sm">
              <h2 className="text-3xl font-black">{title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-[#16211D]/65">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <ContactCta />
    </PublicShell>
  );
}

export function CredmaisContactPage() {
  return (
    <PublicShell>
      <section className="bg-[#F7F4EC] px-5 py-16 text-[#16211D] md:px-8 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B96942]">Contato</p>
            <h1 className="mt-5 text-5xl font-black uppercase leading-none md:text-7xl">Vamos estruturar sua próxima operação.</h1>
            <p className="mt-6 max-w-xl text-xl leading-relaxed text-[#16211D]/65">
              Envie os dados iniciais e a equipe Credmais retorna para entender sua necessidade de antecipação, garantia, crediário, consultoria ou gestão.
            </p>
            <div className="mt-10 grid gap-4">
              <ContactLine icon={Phone} label="Telefone" value="(00) 0000-0000" />
              <ContactLine icon={Mail} label="E-mail" value="contato@credmais.com.br" />
              <ContactLine icon={MapPin} label="Atendimento" value="Brasil, operações para empresas" />
            </div>
          </div>
          <form className="rounded-lg border border-[#16211D]/10 bg-white p-5 shadow-2xl shadow-[#16211D]/10 md:p-8">
            <div className="grid gap-5">
              <Field label="Nome" placeholder="Seu nome" />
              <Field label="Empresa" placeholder="Nome da empresa" />
              <Field label="E-mail" placeholder="email@empresa.com.br" type="email" />
              <label className="grid gap-2">
                <span className="text-sm font-bold uppercase tracking-[0.16em] text-[#16211D]/55">Solução de interesse</span>
                <select className="rounded-lg border border-[#16211D]/12 bg-[#F7F4EC] px-4 py-4 text-base outline-none transition focus:border-[#0D5E45]">
                  {solutions.map((solution) => <option key={solution.slug}>{solution.title}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold uppercase tracking-[0.16em] text-[#16211D]/55">Mensagem</span>
                <textarea className="min-h-36 rounded-lg border border-[#16211D]/12 bg-[#F7F4EC] px-4 py-4 text-base outline-none transition focus:border-[#0D5E45]" placeholder="Conte rapidamente sua necessidade" />
              </label>
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0D5E45] px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#16211D]">
                Enviar solicitação <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </section>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F4EC] font-sans text-[#16211D]">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#16211D]/10 bg-[#F7F4EC]/95 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Credmais Securitizadora">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#0D5E45] text-lg font-black text-white shadow-xl shadow-[#0D5E45]/20">C+</span>
          <span className="leading-none"><span className="block text-xl font-black uppercase tracking-wide">Credmais</span><span className="block text-xs font-medium uppercase tracking-[0.22em] text-[#16211D]/55">Securitizadora</span></span>
        </Link>
        <div className="hidden items-center gap-7 lg:flex">
          <NavLink to="/">Início</NavLink>
          <div className="group relative py-2">
            <button className="flex items-center gap-1 text-sm font-semibold uppercase tracking-[0.18em] text-[#16211D]/70 transition hover:text-[#0D5E45]">Soluções <ArrowUpRight className="h-3.5 w-3.5" /></button>
            <div className="pointer-events-none absolute left-1/2 top-full w-[520px] -translate-x-1/2 pt-4 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
              <div className="grid gap-2 rounded-lg border border-[#16211D]/10 bg-white p-3 shadow-2xl shadow-[#16211D]/10">
                {solutions.map((solution) => {
                  const Icon = solution.icon;
                  return (
                    <Link key={solution.slug} to={`/${solution.slug}`} className="grid grid-cols-[44px_1fr] gap-3 rounded-lg p-3 transition hover:bg-[#DFF7EC]">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#0D5E45] text-white"><Icon className="h-5 w-5" /></span>
                      <span><span className="block font-semibold">{solution.title}</span><span className="block text-sm text-[#16211D]/60">{solution.headline}</span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
          <NavLink to="/sobre">Sobre</NavLink>
          <NavLink to="/contato">Contato</NavLink>
        </div>
        <Link to="/contato" className="hidden rounded-full bg-[#0D5E45] px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#16211D] md:inline-flex">Fale conosco</Link>
        <details className="relative lg:hidden">
          <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-[#16211D]/15"><Menu className="h-5 w-5" /></summary>
          <div className="absolute right-0 top-14 z-50 grid w-72 gap-2 rounded-lg border border-[#16211D]/10 bg-white p-3 shadow-2xl">
            <MobileLink to="/">Início</MobileLink>
            {solutions.map((solution) => <MobileLink key={solution.slug} to={`/${solution.slug}`}>{solution.title}</MobileLink>)}
            <MobileLink to="/sobre">Sobre</MobileLink>
            <MobileLink to="/contato">Contato</MobileLink>
          </div>
        </details>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-[86svh] overflow-hidden bg-[#16211D] text-white">
      <FinancialVisual />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#16211D] to-transparent" />
      <div className="relative z-10 mx-auto flex min-h-[86svh] max-w-7xl flex-col justify-center px-5 py-16 md:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-4xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#DFF7EC] backdrop-blur"><ShieldCheck className="h-4 w-4" /> Liquidez, garantia e controle financeiro</div>
          <h1 className="max-w-5xl text-6xl font-black uppercase leading-[0.9] tracking-normal text-white sm:text-7xl md:text-[112px] lg:text-[132px]">Credmais Securitizadora</h1>
          <p className="mt-7 max-w-2xl text-lg font-light leading-relaxed text-white/75 md:text-2xl">Soluções para transformar recebíveis, boletos e vendas a prazo em uma operação financeira mais previsível, segura e pronta para crescer.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/antecipacao-de-recebiveis" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D8A941] px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#16211D] transition hover:bg-white">Antecipar recebíveis <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/contato" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-white/10">Fale com a Credmais</Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FinancialVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(216,169,65,0.24),transparent_32%),radial-gradient(circle_at_20%_75%,rgba(13,94,69,0.8),transparent_36%)]" />
      <div className="absolute right-[8%] top-[18%] hidden w-[330px] rotate-3 rounded-lg border border-white/20 bg-white/10 p-5 text-white shadow-2xl backdrop-blur md:block"><span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Duplicata</span><strong className="mt-3 block text-5xl font-black">R$ 128.400</strong></div>
      <div className="absolute bottom-[19%] right-[21%] hidden w-[300px] -rotate-3 rounded-lg border border-white/20 bg-white/10 p-5 text-white shadow-2xl backdrop-blur lg:block"><span className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Boleto</span><strong className="mt-3 block text-4xl font-black">Garantido</strong></div>
      <div className="absolute right-[12%] top-[43%] hidden w-[420px] -rotate-2 rounded-lg border border-[#D8A941]/30 bg-[#F7F4EC]/95 p-5 text-[#16211D] shadow-2xl lg:block"><div className="flex items-center justify-between font-black uppercase tracking-[0.12em]"><span>Fluxo previsto</span><BadgeCheck className="h-5 w-5" /></div><div className="mt-5 grid h-36 grid-cols-5 items-end gap-3">{[42, 62, 48, 78, 92].map((height) => <i key={height} className="rounded-t-lg bg-gradient-to-t from-[#0D5E45] to-[#D8A941]" style={{ height: `${height}%` }} />)}</div></div>
      <div className="absolute right-[36%] top-[22%] grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#FFE7A5] via-[#D8A941] to-[#9F7220] font-black text-[#16211D] shadow-2xl shadow-[#D8A941]/30">R$</div>
    </div>
  );
}

function StatsBand() {
  return <section className="bg-[#F7F4EC] px-5 py-8 md:px-8"><div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">{[["5", "soluções financeiras integradas"], ["B2B", "foco em empresas e operações recorrentes"], ["360", "visão de recebíveis, risco e fluxo"]].map(([value, label]) => <div key={value} className="rounded-lg border border-[#16211D]/10 bg-white p-6 shadow-sm"><strong className="block text-4xl font-black text-[#0D5E45]">{value}</strong><span className="mt-2 block text-sm font-medium uppercase tracking-[0.16em] text-[#16211D]/55">{label}</span></div>)}</div></section>;
}

function SolutionsSection() {
  return <section className="bg-[#F7F4EC] px-5 py-20 text-[#16211D] md:px-8 md:py-28" id="solucoes"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Soluções" title="Estrutura financeira para vender, receber e crescer com mais segurança." text="A Credmais combina securitização, garantia, consultoria e controle operacional em soluções que conversam com o ritmo real da empresa." /><div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{solutions.map((solution) => { const Icon = solution.icon; return <Link key={solution.slug} to={`/${solution.slug}`} className="group flex min-h-[280px] flex-col justify-between rounded-lg border border-[#16211D]/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#0D5E45]/30 hover:shadow-2xl hover:shadow-[#16211D]/10"><span className="flex items-start justify-between gap-5"><span className="grid h-14 w-14 place-items-center rounded-lg bg-[#DFF7EC] text-[#0D5E45]"><Icon className="h-7 w-7" /></span><ArrowUpRight className="h-5 w-5 text-[#16211D]/35 transition group-hover:text-[#0D5E45]" /></span><span><span className="mb-3 inline-flex rounded-full bg-[#F7F4EC] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#B96942]">{solution.metric}</span><h3 className="text-3xl font-black leading-tight">{solution.title}</h3><p className="mt-3 text-lg leading-relaxed text-[#16211D]/65">{solution.headline}</p></span></Link>; })}</div></div></section>;
}

function ProcessSection() {
  return <section className="bg-white px-5 py-20 text-[#16211D] md:px-8 md:py-28"><div className="mx-auto max-w-7xl"><SectionIntro eyebrow="Método" title="Da análise ao caixa, com processo claro." text="A jornada foi pensada para reduzir atrito operacional e dar visibilidade ao que acontece em cada etapa." /><div className="mt-12 grid gap-4 md:grid-cols-3">{processSteps.map((step, index) => { const Icon = step.icon; return <div key={step.title} className="rounded-lg border border-[#16211D]/10 bg-[#F7F4EC] p-7"><span className="mb-10 flex items-center justify-between"><span className="text-sm font-black uppercase tracking-[0.2em] text-[#0D5E45]">0{index + 1}</span><span className="grid h-12 w-12 place-items-center rounded-full bg-[#0D5E45] text-white"><Icon className="h-5 w-5" /></span></span><h3 className="text-2xl font-black">{step.title}</h3><p className="mt-3 leading-relaxed text-[#16211D]/65">{step.text}</p></div>; })}</div></div></section>;
}

function CredibilitySection() {
  return <section className="overflow-hidden bg-[#16211D] px-5 py-20 text-white md:px-8 md:py-28"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.24em] text-[#D8A941]">Credibilidade operacional</p><h2 className="mt-5 text-4xl font-black uppercase leading-none md:text-6xl">Controle para quem precisa decidir rápido.</h2><p className="mt-6 text-lg leading-relaxed text-white/70">A Credmais trabalha para conectar liquidez, documentação e acompanhamento, apoiando empresas que precisam de previsibilidade financeira sem perder ritmo comercial.</p></div><div className="grid gap-3">{["Análise de carteira de recebíveis", "Formalização com clareza", "Acompanhamento de fluxo e conciliação", "Soluções ajustadas ao perfil da operação"].map((item) => <div key={item} className="flex items-center gap-4 rounded-lg border border-white/12 bg-white/10 p-5"><CheckCircle2 className="h-6 w-6 flex-none text-[#D8A941]" /><span className="text-lg font-medium">{item}</span></div>)}</div></div></section>;
}

function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <section className="relative overflow-hidden bg-[#16211D] px-5 py-20 text-white md:px-8 md:py-28"><FinancialVisual /><div className="relative z-10 mx-auto max-w-7xl"><p className="text-sm font-bold uppercase tracking-[0.24em] text-[#D8A941]">{eyebrow}</p><h1 className="mt-5 max-w-5xl text-5xl font-black uppercase leading-none md:text-7xl">{title}</h1><p className="mt-6 max-w-3xl text-xl leading-relaxed text-white/70">{text}</p></div></section>;
}

function SectionIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="max-w-4xl"><p className="text-sm font-bold uppercase tracking-[0.24em] text-[#B96942]">{eyebrow}</p><h2 className="mt-4 text-4xl font-black uppercase leading-none md:text-6xl">{title}</h2><p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#16211D]/65">{text}</p></div>;
}

function ContactCta() {
  return <section className="bg-[#F7F4EC] px-5 py-14 md:px-8 md:py-20"><div className="mx-auto grid max-w-7xl gap-6 rounded-lg bg-[#0D5E45] p-7 text-white shadow-2xl shadow-[#0D5E45]/15 md:grid-cols-[1fr_auto] md:items-center md:p-10"><div><p className="text-sm font-bold uppercase tracking-[0.22em] text-[#DFF7EC]">Próximo passo</p><h2 className="mt-3 text-3xl font-black uppercase leading-tight md:text-5xl">Converse com a Credmais sobre sua operação.</h2></div><Link to="/contato" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#0D5E45] transition hover:bg-[#D8A941] hover:text-[#16211D]">Entrar em contato <ArrowUpRight className="h-4 w-4" /></Link></div></section>;
}

function ContactLine({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return <div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#DFF7EC] text-[#0D5E45]"><Icon className="h-5 w-5" /></span><span><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[#16211D]/50">{label}</span><span className="block text-lg font-semibold">{value}</span></span></div>;
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return <label className="grid gap-2"><span className="text-sm font-bold uppercase tracking-[0.16em] text-[#16211D]/55">{label}</span><input className="rounded-lg border border-[#16211D]/12 bg-[#F7F4EC] px-4 py-4 text-base outline-none transition focus:border-[#0D5E45]" placeholder={placeholder} type={type} /></label>;
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="text-sm font-semibold uppercase tracking-[0.18em] text-[#16211D]/70 transition hover:text-[#0D5E45]">{children}</Link>;
}

function MobileLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="rounded-lg border border-[#16211D]/10 bg-white px-4 py-3 font-semibold">{children}</Link>;
}

function Footer() {
  return <footer className="border-t border-[#16211D]/10 bg-white px-5 py-10 text-[#16211D] md:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><strong className="block text-2xl font-black uppercase">Credmais</strong><span className="text-sm font-medium uppercase tracking-[0.2em] text-[#16211D]/55">Securitizadora</span></div><div className="flex flex-wrap gap-4 text-sm font-semibold text-[#16211D]/60">{solutions.map((solution) => <Link key={solution.slug} to={`/${solution.slug}`}>{solution.title}</Link>)}</div></div></footer>;
}
