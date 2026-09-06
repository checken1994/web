import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import {
  Activity, Bot, CheckCircle2, ChevronRight, CircleDot, Clock3, Command,
  Cpu, FileCheck2, KeyRound, LayoutDashboard, LogOut, Menu, MessageSquare,
  MoreHorizontal, Play, Plus, Radio, Search, Server, Settings2, ShieldCheck,
  Sparkles, TerminalSquare, XCircle, Zap,
} from "lucide-react";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "sessions", label: "Sessions", icon: MessageSquare },
  { id: "agents", label: "Bots & agents", icon: Bot },
  { id: "models", label: "AI models", icon: Sparkles },
  { id: "artifacts", label: "Artifacts", icon: FileCheck2 },
  { id: "jobs", label: "Scheduled jobs", icon: Clock3 },
  { id: "audit", label: "Audit activity", icon: ShieldCheck },
];

const agents = [
  { name: "SCP Orchestrator", type: "Control plane", status: "Online", tone: "green", scope: "task:dispatch · evidence:write" },
  { name: "Reality Verifier", type: "Verifier", status: "Online", tone: "green", scope: "evidence:read · release:block" },
  { name: "Runtime Auditor", type: "Auditor", status: "Standby", tone: "amber", scope: "runtime:read · logs:read" },
  { name: "Safe Auto-fix", type: "Implementer", status: "Restricted", tone: "slate", scope: "branch:write · tests:run" },
];

const sessions = [
  { title: "Post-merge main audit", meta: "main · exact SHA c871038", status: "Running", time: "now", icon: Activity },
  { title: "Gateway resilience review", meta: "provider fallback · A05", status: "Completed", time: "18m", icon: CheckCircle2 },
  { title: "RAG evidence verification", meta: "1,000 questions · pilot", status: "Unknown", time: "2h", icon: CircleDot },
];

const models = [
  { name: "Manus 1.6 Max", provider: "Manus", latency: "—", state: "Available", accent: "violet" },
  { name: "GPT-5.5", provider: "OpenAI", latency: "—", state: "API route", accent: "cyan" },
  { name: "Gemini 3.1 Pro", provider: "Google", latency: "—", state: "API route", accent: "amber" },
];

function StatusDot({ tone }: { tone: string }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />;
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Activity; tone: string }) {
  return (
    <Card className="metric-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">{detail}</p></div>
          <div className={`metric-icon metric-${tone}`}><Icon size={18} /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && <Button variant="ghost" size="sm" className="quiet-button">{action}<ChevronRight size={14} /></Button>}</div>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const section = new URLSearchParams(location.split("?")[1] ?? "").get("section") || "overview";
  const [active, setActive] = useState(section);
  const [query, setQuery] = useState("");
  useEffect(() => setActive(section), [section]);
  const [selectedModel, setSelectedModel] = useState("Manus 1.6 Max");
  const [command, setCommand] = useState("");
  const [commandError, setCommandError] = useState<string | null>(null);
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const summary = trpc.dashboard.summary.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const createSession = trpc.sessions.create.useMutation();
  const sendSession = trpc.sessions.send.useMutation();

  const submitCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed || createSession.isPending || sendSession.isPending) return;
    setCommandError(null);
    try {
      const created = await createSession.mutateAsync({ title: trimmed.slice(0, 180), selectedModel });
      await sendSession.mutateAsync({ sessionId: created.id, content: trimmed });
      setCommand("");
      setActive("sessions");
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "The command could not be completed.");
    }
  };

  const filteredAgents = useMemo(() => agents.filter((agent) => `${agent.name} ${agent.type}`.toLowerCase().includes(query.toLowerCase())), [query]);

  if (loading) return <div className="page-loading"><Radio className="spin" size={18} /> Establishing secure session…</div>;
  if (!isAuthenticated) return <div className="login-screen"><div className="login-card"><div className="brand-mark"><TerminalSquare size={22} /></div><p className="eyebrow">SCP CONTROL PLANE</p><h1>Operate with evidence.</h1><p>Secure remote operations for sessions, agents, models and verified outcomes.</p><Button onClick={startLogin} className="primary-button w-full">Sign in securely <ChevronRight size={16} /></Button><p className="login-note"><ShieldCheck size={14} /> Authentication is handled by Manus OAuth.</p></div></div>;

  const displayName = user?.name || me.data?.name || "Operator";
  const content = (
    <div className="dashboard-shell">
      <header className="topbar">
        <div className="topbar-title"><div className="brand-mark small"><TerminalSquare size={17} /></div><div><p className="eyebrow">SCP / CONTROL PLANE</p><h1>{navItems.find((item) => item.id === active)?.label}</h1></div></div>
        <div className="topbar-actions"><div className="secure-pill"><StatusDot tone="green" /> system nominal</div><Button variant="ghost" size="icon" className="icon-button" aria-label="Settings"><Settings2 size={17} /></Button><Button variant="ghost" size="icon" className="icon-button" onClick={() => logout()} aria-label="Sign out"><LogOut size={17} /></Button><div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div></div>
      </header>

      <div className="mobile-nav"><Menu size={17} /><select value={active} onChange={(event) => setActive(event.target.value)} aria-label="Navigate dashboard">{navItems.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></div>

      {active === "overview" && <main className="content-stack">
        <div className="hero-row"><div><p className="eyebrow accent-eyebrow">THURSDAY · 05 SEP 2026</p><h2>Good to see you, {displayName.split(" ")[0]}.</h2><p className="hero-copy">Your control plane is watching the boundary between intent and action.</p></div><Button className="primary-button" onClick={() => setActive("sessions")}><Plus size={16} /> New session</Button></div>
        {summary.isError && <div className="dashboard-error" role="alert" aria-live="polite">Unable to load the server summary. Check your session and try again.</div>}
        <div className="metrics-grid"><MetricCard label="Active sessions" value={summary.data ? String(summary.data.sessions).padStart(2, "0") : "—"} detail="server-synced sessions" icon={MessageSquare} tone="cyan" /><MetricCard label="Agents online" value={summary.data ? String(summary.data.agents).padStart(2, "0") : "—"} detail="owner-scoped registry" icon={Bot} tone="violet" /><MetricCard label="Evidence artifacts" value={summary.data ? String(summary.data.artifacts).padStart(2, "0") : "—"} detail="metadata and provenance" icon={ShieldCheck} tone="green" /><MetricCard label="Scheduled jobs" value={summary.data ? String(summary.data.jobs).padStart(2, "0") : "—"} detail="Heartbeat-backed schedules" icon={Clock3} tone="amber" /></div>
        <div className="main-grid"><Card className="panel-card session-panel"><CardHeader className="panel-header"><div><p className="eyebrow">LIVE OPERATIONS</p><CardTitle>Recent sessions</CardTitle></div><Button variant="ghost" size="sm" className="quiet-button" onClick={() => setActive("sessions")}>View all <ChevronRight size={14} /></Button></CardHeader><CardContent className="p-0"><div className="list-stack">{sessions.map((session) => { const Icon = session.icon; return <button className="list-row" key={session.title} onClick={() => setActive("sessions")}><span className="row-icon"><Icon size={16} /></span><span className="row-main"><strong>{session.title}</strong><small>{session.meta}</small></span><span className={`status-badge status-${session.status.toLowerCase()}`}><StatusDot tone={session.status === "Running" ? "green" : session.status === "Unknown" ? "amber" : "cyan"} />{session.status}</span><small className="row-time">{session.time}</small><ChevronRight size={15} className="row-chevron" /></button>; })}</div></CardContent></Card>
          <Card className="panel-card command-panel"><CardHeader className="panel-header"><div><p className="eyebrow">SECURE COMMAND</p><CardTitle>Ask the control plane</CardTitle></div><Badge className="badge-dark"><KeyRound size={12} /> server-side</Badge></CardHeader><CardContent><div className="command-box"><div className="command-line"><span className="prompt">scp@remote ›</span><label htmlFor="command-input" className="sr-only">Describe a task for the control plane</label><Input id="command-input" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Describe a task to verify…" aria-invalid={Boolean(commandError)} aria-describedby={commandError ? "command-error" : undefined} /></div><Button size="sm" className="primary-button" onClick={submitCommand} disabled={createSession.isPending || sendSession.isPending}><Play size={14} /> {createSession.isPending || sendSession.isPending ? "Running…" : "Run"}</Button></div>{commandError && <p id="command-error" className="dashboard-error" role="alert">{commandError}</p>}<p className="command-help"><Zap size={13} /> Every command is authorized, journaled and assigned a postcondition.</p></CardContent></Card></div>
        <div className="bottom-grid"><Card className="panel-card"><CardHeader className="panel-header"><div><p className="eyebrow">AGENT REGISTRY</p><CardTitle>Capability posture</CardTitle></div><Button variant="ghost" size="sm" className="quiet-button" onClick={() => setActive("agents")}>Manage <ChevronRight size={14} /></Button></CardHeader><CardContent><div className="agent-compact-list">{filteredAgents.slice(0, 3).map((agent) => <div className="agent-compact" key={agent.name}><span className="agent-avatar"><Bot size={15} /></span><span><strong>{agent.name}</strong><small>{agent.scope}</small></span><span className="agent-status"><StatusDot tone={agent.tone} />{agent.status}</span></div>)}</div></CardContent></Card><Card className="panel-card"><CardHeader className="panel-header"><div><p className="eyebrow">MODEL ROUTER</p><CardTitle>Preferred model</CardTitle></div><Button variant="ghost" size="icon" className="icon-button"><MoreHorizontal size={17} /></Button></CardHeader><CardContent><div className="model-select"><Sparkles size={18} /><select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} aria-label="Preferred AI model">{models.map((model) => <option key={model.name}>{model.name}</option>)}</select><ChevronRight size={16} /></div><p className="metric-detail model-footnote">Requests stay server-side. Provider credentials never enter the browser.</p></CardContent></Card></div>
      </main>}

      {active !== "overview" && <main className="content-stack detail-view"><div className="detail-toolbar"><div><p className="eyebrow">REMOTE OPERATIONS</p><h2>{navItems.find((item) => item.id === active)?.label}</h2></div><div className="search-box"><Search size={15} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter records…" /></div></div>
        {active === "sessions" && <Card className="panel-card"><CardContent className="p-0"><div className="list-stack">{sessions.concat({ title: "Ruleset evidence lock", meta: "main · PR #25 diagnostic", status: "Failed", time: "yesterday", icon: XCircle }).map((session) => <button className="list-row" key={session.title}><span className="row-icon"><session.icon size={16} /></span><span className="row-main"><strong>{session.title}</strong><small>{session.meta}</small></span><span className={`status-badge status-${session.status.toLowerCase()}`}><StatusDot tone={session.status === "Completed" ? "cyan" : session.status === "Running" ? "green" : session.status === "Failed" ? "red" : "amber"} />{session.status}</span><small className="row-time">{session.time}</small><ChevronRight size={15} className="row-chevron" /></button>)}</div></CardContent></Card>}
        {active === "agents" && <div className="cards-grid">{filteredAgents.map((agent) => <Card className="panel-card agent-card" key={agent.name}><CardContent><div className="agent-card-head"><span className="agent-avatar large"><Bot size={19} /></span><Badge variant="outline" className="outline-badge"><StatusDot tone={agent.tone} />{agent.status}</Badge></div><h3>{agent.name}</h3><p className="muted">{agent.type}</p><Separator /><p className="eyebrow">CAPABILITY SCOPE</p><code>{agent.scope}</code><Button variant="outline" className="w-full mt-5">Review permissions</Button></CardContent></Card>)}</div>}
        {active === "models" && <div className="cards-grid">{models.map((model) => <Card className="panel-card model-card" key={model.name}><CardContent><div className={`model-orb orb-${model.accent}`}><Sparkles size={20} /></div><h3>{model.name}</h3><p className="muted">{model.provider} · {model.state}</p><div className="model-stat"><span>Routing</span><strong>Server-side only</strong></div><Button className="primary-button w-full" onClick={() => setSelectedModel(model.name)}>Set preferred</Button></CardContent></Card>)}</div>}
        {(active === "artifacts" || active === "jobs" || active === "audit") && <Card className="panel-card empty-card"><div className="empty-icon"><FileCheck2 size={20} /></div><h3>{active === "artifacts" ? "Evidence-backed outputs" : active === "jobs" ? "Heartbeat schedules" : "Immutable activity trail"}</h3><p>No records have been synchronized yet. The server-side data model is ready for authorized operations.</p><Button variant="outline" onClick={() => setActive("overview")}>Back to overview</Button></Card>}
      </main>}
    </div>
  );
  return <DashboardLayout>{content}</DashboardLayout>;
}
