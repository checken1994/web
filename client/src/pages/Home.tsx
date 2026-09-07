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
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const summary = trpc.dashboard.summary.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const sessionQuery = trpc.sessions.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const agentQuery = trpc.agents.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const capabilityQuery = trpc.agents.capabilities.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const modelQuery = trpc.models.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const artifactQuery = trpc.artifacts.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const jobQuery = trpc.jobs.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const auditQuery = trpc.audit.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const historyQuery = trpc.sessions.history.useQuery({ sessionId: selectedSessionId ?? 0 }, { enabled: isAuthenticated && selectedSessionId !== null, retry: false });
  const jobRunsQuery = trpc.jobs.runs.useQuery({ jobId: selectedJobId ?? 0 }, { enabled: isAuthenticated && selectedJobId !== null, retry: false });
  const createSession = trpc.sessions.create.useMutation();
  const sendSession = trpc.sessions.send.useMutation();
  const cancelSession = trpc.sessions.cancel.useMutation();
  const toggleCapability = trpc.agents.toggleCapability.useMutation();
  const selectModel = trpc.models.select.useMutation();
  const toggleJob = trpc.jobs.toggle.useMutation();
  const accessArtifact = trpc.artifacts.access.useMutation();
  const [mutationError, setMutationError] = useState<string | null>(null);

  const chooseModel = async (model: string) => {
    setMutationError(null);
    setSelectedModel(model);
    try { await selectModel.mutateAsync({ model }); await modelQuery.refetch(); } catch (error) { setMutationError(error instanceof Error ? error.message : "Model selection failed."); }
  };

  const openArtifact = async (id: number, mode: "preview" | "download") => {
    setMutationError(null);
    try {
      const result = await accessArtifact.mutateAsync({ id });
      if (mode === "preview") window.open(result.url, "_blank", "noopener,noreferrer");
      else { const link = document.createElement("a"); link.href = result.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.download = "scp-artifact"; link.click(); }
    } catch (error) { setMutationError(error instanceof Error ? error.message : "Artifact access failed."); }
  };

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

  const serverSessions = useMemo(() => (sessionQuery.data ?? []).map((item) => ({ id: item.id, title: item.title, meta: `${item.selectedModel ?? "unassigned model"} · ${item.status}`, status: item.status.charAt(0).toUpperCase() + item.status.slice(1), time: new Date(item.lastActivityAt).toLocaleString(), icon: item.status === "failed" ? XCircle : Activity })), [sessionQuery.data]);
  const serverAgents = useMemo(() => (agentQuery.data ?? []).map((item) => ({ name: item.name, type: item.agentType, scope: item.description ?? "owner-scoped capability registry", status: item.status, tone: item.status === "online" ? "green" : "amber" as const })), [agentQuery.data]);
  const serverModels = useMemo(() => {
    const configured = modelQuery.data?.configured ?? [];
    if (configured.length) return configured.map((item) => ({ name: item.displayName, provider: item.provider, state: item.enabled ? "Enabled" : "Disabled", accent: "violet" }));
    return (modelQuery.data?.available ?? []).slice(0, 12).map((item) => ({ name: item.id, provider: item.ownedBy ?? "catalog", state: "Available", accent: "cyan" }));
  }, [modelQuery.data]);
  const serverArtifacts = artifactQuery.data ?? [];
  const serverJobs = jobQuery.data ?? [];
  const serverAudits = auditQuery.data ?? [];
  const serverCapabilities = capabilityQuery.data ?? [];
  const retryLastCommand = async () => {
    if (selectedSessionId === null || !historyQuery.data) return;
    const latest = historyQuery.data[historyQuery.data.length - 1];
    const latestUser = [...historyQuery.data].reverse().find((message) => message.role === "user");
    if (latest?.role !== "assistant" || latest.status !== "failed" || !latestUser) return;
    setMutationError(null);
    try { await sendSession.mutateAsync({ sessionId: selectedSessionId, content: latestUser.content, model: selectedModel }); await historyQuery.refetch(); } catch (error) { setMutationError(error instanceof Error ? error.message : "Retry failed."); }
  };

  const cancelSessionAction = async (id: number) => {
    setMutationError(null);
    try { await cancelSession.mutateAsync({ sessionId: id }); await sessionQuery.refetch(); } catch (error) { setMutationError(error instanceof Error ? error.message : "Session cancellation failed."); }
  };

  const setCapabilityEnabled = async (id: number, enabled: boolean) => {
    setMutationError(null);
    try { await toggleCapability.mutateAsync({ id, enabled }); await capabilityQuery.refetch(); } catch (error) { setMutationError(error instanceof Error ? error.message : "Capability update failed."); }
  };

  const setJobEnabled = async (id: number, enabled: boolean) => {
    setMutationError(null);
    try { await toggleJob.mutateAsync({ id, enabled }); await jobQuery.refetch(); } catch (error) { setMutationError(error instanceof Error ? error.message : "Job update failed."); }
  };

  const filteredAgents = useMemo(() => serverAgents.filter((agent) => `${agent.name} ${agent.type}`.toLowerCase().includes(query.toLowerCase())), [query, serverAgents]);

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

      {active === "overview" && <section className="content-stack" aria-labelledby="overview-heading">
        <div className="hero-row"><div><p className="eyebrow accent-eyebrow">THURSDAY · 05 SEP 2026</p><h2 id="overview-heading">Good to see you, {displayName.split(" ")[0]}.</h2><p className="hero-copy">Your control plane is watching the boundary between intent and action.</p></div><Button className="primary-button" onClick={() => setActive("sessions")}><Plus size={16} /> New session</Button></div>
        {summary.isError && <div className="dashboard-error" role="alert" aria-live="polite">Unable to load the server summary. Check your session and try again.</div>}
        <div className="metrics-grid"><MetricCard label="Active sessions" value={summary.data ? String(summary.data.sessions).padStart(2, "0") : "—"} detail="server-synced sessions" icon={MessageSquare} tone="cyan" /><MetricCard label="Agents online" value={summary.data ? String(summary.data.agents).padStart(2, "0") : "—"} detail="owner-scoped registry" icon={Bot} tone="violet" /><MetricCard label="Evidence artifacts" value={summary.data ? String(summary.data.artifacts).padStart(2, "0") : "—"} detail="metadata and provenance" icon={ShieldCheck} tone="green" /><MetricCard label="Scheduled jobs" value={summary.data ? String(summary.data.jobs).padStart(2, "0") : "—"} detail="Heartbeat-backed schedules" icon={Clock3} tone="amber" /></div>
        <div className="main-grid"><Card className="panel-card session-panel"><CardHeader className="panel-header"><div><p className="eyebrow">LIVE OPERATIONS</p><CardTitle>Recent sessions</CardTitle></div><Button variant="ghost" size="sm" className="quiet-button" onClick={() => setActive("sessions")}>View all <ChevronRight size={14} /></Button></CardHeader><CardContent className="p-0"><div className="list-stack">{serverSessions.slice(0, 3).map((session) => { const Icon = session.icon; return <button className="list-row" key={session.id} onClick={() => { setActive("sessions"); setSelectedSessionId(session.id); }}><span className="row-icon"><Icon size={16} /></span><span className="row-main"><strong>{session.title}</strong><small>{session.meta}</small></span><span className={`status-badge status-${session.status.toLowerCase()}`}><StatusDot tone={session.status === "Running" ? "green" : session.status === "Unknown" ? "amber" : "cyan"} />{session.status}</span><small className="row-time">{session.time}</small><ChevronRight size={15} className="row-chevron" /></button>; })}</div></CardContent></Card>
          <Card className="panel-card command-panel"><CardHeader className="panel-header"><div><p className="eyebrow">SECURE COMMAND</p><CardTitle>Ask the control plane</CardTitle></div><Badge className="badge-dark"><KeyRound size={12} /> server-side</Badge></CardHeader><CardContent><div className="command-box"><div className="command-line"><span className="prompt">scp@remote ›</span><label htmlFor="command-input" className="sr-only">Describe a task for the control plane</label><Input id="command-input" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Describe a task to verify…" aria-invalid={Boolean(commandError)} aria-describedby={commandError ? "command-error" : undefined} /></div><Button size="sm" className="primary-button" onClick={submitCommand} disabled={createSession.isPending || sendSession.isPending}><Play size={14} /> {createSession.isPending || sendSession.isPending ? "Running…" : "Run"}</Button></div>{commandError && <p id="command-error" className="dashboard-error" role="alert">{commandError}</p>}<p className="command-help"><Zap size={13} /> Every command is authorized, journaled and assigned a postcondition.</p></CardContent></Card></div>
        <div className="bottom-grid"><Card className="panel-card"><CardHeader className="panel-header"><div><p className="eyebrow">AGENT REGISTRY</p><CardTitle>Capability posture</CardTitle></div><Button variant="ghost" size="sm" className="quiet-button" onClick={() => setActive("agents")}>Manage <ChevronRight size={14} /></Button></CardHeader><CardContent><div className="agent-compact-list">{filteredAgents.slice(0, 3).map((agent) => <div className="agent-compact" key={agent.name}><span className="agent-avatar"><Bot size={15} /></span><span><strong>{agent.name}</strong><small>{agent.scope}</small></span><span className="agent-status"><StatusDot tone={agent.tone} />{agent.status}</span></div>)}</div></CardContent></Card><Card className="panel-card"><CardHeader className="panel-header"><div><p className="eyebrow">MODEL ROUTER</p><CardTitle>Preferred model</CardTitle></div><Button variant="ghost" size="icon" className="icon-button"><MoreHorizontal size={17} /></Button></CardHeader><CardContent><div className="model-select"><Sparkles size={18} /><select value={selectedModel} onChange={(event) => chooseModel(event.target.value)} aria-label="Preferred AI model">{serverModels.map((model) => <option key={model.name}>{model.name}</option>)}</select><ChevronRight size={16} /></div><p className="metric-detail model-footnote">Requests stay server-side. Provider credentials never enter the browser.</p></CardContent></Card></div>
      </section>}

      {mutationError && <div className="content-stack pb-0"><div className="dashboard-error" role="alert">{mutationError}</div></div>}
      {active !== "overview" && <section className="content-stack detail-view" aria-labelledby="detail-heading"><div className="detail-toolbar"><div><p className="eyebrow">REMOTE OPERATIONS</p><h2 id="detail-heading">{navItems.find((item) => item.id === active)?.label}</h2></div><div className="search-box"><Search size={15} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter records…" /></div></div>
        {active === "sessions" && <Card className="panel-card"><CardContent className="p-0"><div className="list-stack">{serverSessions.length === 0 && <div className="empty-card"><div className="empty-icon"><MessageSquare size={20} /></div><h3>No sessions yet</h3><p>Start a server-authorized command from the overview to create the first session.</p></div>}{serverSessions.map((session) => { const Icon = session.icon; return <button className="list-row" key={session.id} onClick={() => setSelectedSessionId(session.id)}><span className="row-icon"><Icon size={16} /></span><span className="row-main"><strong>{session.title}</strong><small>{session.meta}</small></span><span className={`status-badge status-${session.status.toLowerCase()}`}><StatusDot tone={session.status === "Completed" ? "cyan" : session.status === "Running" ? "green" : session.status === "Failed" ? "red" : "amber"} />{session.status}</span><small className="row-time">{session.time}</small>{(session.status.toLowerCase() === "queued" || session.status.toLowerCase() === "running") && <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); cancelSessionAction(session.id); }} disabled={cancelSession.isPending}>Cancel</Button>}<ChevronRight size={15} className="row-chevron" /></button>; })}</div></CardContent></Card>}
        {active === "sessions" && selectedSessionId !== null && <Card className="panel-card session-history"><CardHeader className="panel-header"><div><p className="eyebrow">SESSION HISTORY</p><CardTitle>Evidence trail for session #{selectedSessionId}</CardTitle></div><Button size="sm" variant="outline" onClick={retryLastCommand} disabled={sendSession.isPending || historyQuery.isLoading || historyQuery.data?.[historyQuery.data.length - 1]?.status !== "failed"}>Retry failed command</Button></CardHeader><CardContent>{historyQuery.isLoading && <p className="muted">Loading message history…</p>}{historyQuery.isError && <div className="dashboard-error" role="alert">Unable to load this session history.</div>}{!historyQuery.isLoading && !historyQuery.isError && (historyQuery.data?.length ?? 0) === 0 && <p className="muted">No messages recorded for this session.</p>}<div className="history-stack">{historyQuery.data?.map((message) => <div className={`history-message history-${message.role}`} key={message.id}><strong>{message.role}</strong><p>{message.content}</p><small>{message.status} · {new Date(message.createdAt).toLocaleString()}</small></div>)}</div></CardContent></Card>}
        {active === "agents" && <div className="cards-grid">{filteredAgents.map((agent) => <Card className="panel-card agent-card" key={agent.name}><CardContent><div className="agent-card-head"><span className="agent-avatar large"><Bot size={19} /></span><Badge variant="outline" className="outline-badge"><StatusDot tone={agent.tone} />{agent.status}</Badge></div><h3>{agent.name}</h3><p className="muted">{agent.type}</p><Separator /><p className="eyebrow">CAPABILITY SCOPE</p><code>{agent.scope}</code><Button variant="outline" className="w-full mt-5">Review permissions</Button></CardContent></Card>)}</div>}
        {active === "agents" && <Card className="panel-card capability-panel"><CardHeader className="panel-header"><div><p className="eyebrow">CAPABILITY CONTROL</p><CardTitle>Permission switches</CardTitle></div><Badge className="badge-dark">admin-gated</Badge></CardHeader><CardContent><div className="capability-list">{capabilityQuery.isLoading && <p className="muted">Loading capability registry…</p>}{capabilityQuery.isError && <div className="dashboard-error" role="alert">Unable to load capability registry.</div>}{!capabilityQuery.isLoading && !capabilityQuery.isError && serverCapabilities.length === 0 && <p className="muted">No capability records are registered.</p>}{serverCapabilities.map((capability) => <div className="capability-row" key={capability.id}><span className="row-main"><strong>{capability.capability}</strong><small>{capability.scope} · agent #{capability.agentId}</small></span><Button size="sm" variant="outline" onClick={() => setCapabilityEnabled(capability.id, !Boolean(capability.enabled))} disabled={toggleCapability.isPending}>{capability.enabled ? "Disable" : "Enable"}</Button></div>)}</div></CardContent></Card>}
        {active === "models" && <div className="cards-grid">{serverModels.map((model) => <Card className="panel-card model-card" key={model.name}><CardContent><div className={`model-orb orb-${model.accent}`}><Sparkles size={20} /></div><h3>{model.name}</h3><p className="muted">{model.provider} · {model.state}</p><div className="model-stat"><span>Routing</span><strong>Server-side only</strong></div><Button className="primary-button w-full" onClick={() => chooseModel(model.name)}>Set preferred</Button></CardContent></Card>)}</div>}
        {active === "artifacts" && <Card className="panel-card"><CardContent className="p-0"><div className="list-stack">{artifactQuery.isLoading && <div className="empty-card"><div className="empty-icon"><Radio className="spin" size={20} /></div><h3>Loading artifacts</h3><p>Reading owner-scoped artifact metadata…</p></div>}{artifactQuery.isError && <div className="dashboard-error" role="alert">Unable to load artifact metadata. No access URL was created.</div>}{!artifactQuery.isLoading && !artifactQuery.isError && serverArtifacts.length === 0 && <div className="empty-card"><div className="empty-icon"><FileCheck2 size={20} /></div><h3>No artifacts yet</h3><p>Artifacts appear here after a server-side operation writes provenance metadata.</p></div>}{serverArtifacts.map((artifact) => <div className="list-row" key={artifact.id}><span className="row-icon"><FileCheck2 size={16} /></span><span className="row-main"><strong>{artifact.name}</strong><small>{artifact.status} · {artifact.mimeType ?? "unknown type"} · {artifact.sha256 ? `sha256 ${artifact.sha256.slice(0, 12)}…` : "hash pending"}</small></span><span className="status-badge"><StatusDot tone={artifact.status === "ready" ? "green" : artifact.status === "failed" ? "red" : "amber"} />{artifact.status}</span><Button size="sm" variant="outline" onClick={() => openArtifact(artifact.id, "preview")} disabled={!artifact.storageKey || accessArtifact.isPending}>Preview</Button><Button size="sm" variant="outline" onClick={() => openArtifact(artifact.id, "download")} disabled={!artifact.storageKey || accessArtifact.isPending}>Download</Button><details className="artifact-provenance"><summary>Provenance</summary><code>{artifact.provenance ? JSON.stringify(artifact.provenance, null, 2) : "No provenance payload"}</code></details></div>)}</div></CardContent></Card>}
        {active === "jobs" && <Card className="panel-card"><CardContent className="p-0"><div className="list-stack">{serverJobs.length === 0 && <div className="empty-card"><div className="empty-icon"><Clock3 size={20} /></div><h3>No scheduled jobs</h3><p>Heartbeat-backed schedules will be listed here after an admin creates one.</p></div>}{serverJobs.map((job) => <div className="list-row" key={job.id}><span className="row-icon"><Clock3 size={16} /></span><span className="row-main"><strong>{job.name}</strong><small>{job.schedule} · last run: {job.lastStatus}</small></span><span className="status-badge"><StatusDot tone={job.enabled ? "green" : "amber"} />{job.enabled ? "Enabled" : "Disabled"}</span><Button size="sm" variant="outline" onClick={() => setSelectedJobId(job.id)}>Runs</Button><Button size="sm" variant="outline" onClick={() => setJobEnabled(job.id, !Boolean(job.enabled))} disabled={toggleJob.isPending}>{job.enabled ? "Disable" : "Enable"}</Button></div>)}</div></CardContent></Card>}
        {active === "jobs" && selectedJobId !== null && <Card className="panel-card"><CardHeader className="panel-header"><div><p className="eyebrow">JOB RUN HISTORY</p><CardTitle>Runs for job #{selectedJobId}</CardTitle></div></CardHeader><CardContent>{jobRunsQuery.isLoading && <p className="muted">Loading job runs…</p>}{jobRunsQuery.isError && <div className="dashboard-error" role="alert">Unable to load job runs.</div>}{!jobRunsQuery.isLoading && !jobRunsQuery.isError && (jobRunsQuery.data?.length ?? 0) === 0 && <p className="muted">No runs recorded for this job.</p>}<div className="history-stack">{jobRunsQuery.data?.map((run) => <div className="history-message" key={run.id}><strong>{run.status}</strong><p>Started {new Date(run.startedAt).toLocaleString()}{run.finishedAt ? ` · finished ${new Date(run.finishedAt).toLocaleString()}` : ""}</p>{run.error && <small>{run.error}</small>}</div>)}</div></CardContent></Card>}
        {active === "audit" && <Card className="panel-card"><CardContent className="p-0"><div className="list-stack">{serverAudits.length === 0 && <div className="empty-card"><div className="empty-icon"><ShieldCheck size={20} /></div><h3>No audit events yet</h3><p>Critical operations are recorded server-side with actor, action, status and timestamp.</p></div>}{serverAudits.map((event) => <div className="list-row" key={event.id}><span className="row-icon"><ShieldCheck size={16} /></span><span className="row-main"><strong>{event.action}</strong><small>{event.targetType}{event.targetId ? ` #${event.targetId}` : ""} · {new Date(event.createdAt).toLocaleString()}</small></span><span className="status-badge"><StatusDot tone={event.status === "completed" ? "green" : event.status === "failed" ? "red" : "amber"} />{event.status}</span></div>)}</div></CardContent></Card>}
      </section>}
    </div>
  );
  return <DashboardLayout>{content}</DashboardLayout>;
}
