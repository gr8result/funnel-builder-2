import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  Download,
  ExternalLink,
  FileText,
  LogOut,
  Send,
  Settings,
} from "lucide-react";
import { supabase } from "../utils/supabase-client";
import {
  loadClientPortalProject,
  loadPortalAudit,
  loadPortalSettings,
  savePortalSettings,
  sendPortalInvitation,
  sendPortalMessage,
  submitPortalApproval,
} from "./apiClient";
import { EMPTY_PORTAL_DATA, PORTAL_TABS } from "./clientPortalData";

export default function ClientPortalPage() {
  const router = useRouter();
  const projectId = typeof router.query.projectId === "string" ? router.query.projectId : "";
  const workspaceId = typeof router.query.workspace_id === "string" ? router.query.workspace_id : "";
  const requestedMode = router.query.mode === "preview" ? "preview" : "client";
  const [activeTab, setActiveTab] = useState("overview");
  const [portalData, setPortalData] = useState(EMPTY_PORTAL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsState, setSettingsState] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [invitePreview, setInvitePreview] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);

  useEffect(() => {
    if (!router.isReady || !projectId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const payload = await loadClientPortalProject({ projectId, workspaceId, mode: requestedMode });
        if (!cancelled) setPortalData(payload);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError.status === 401) {
          const redirect = encodeURIComponent(router.asPath || `/client-portal/${projectId}`);
          router.replace(`/client-portal?redirect=${redirect}`);
          return;
        }
        setError(loadError.message || "Could not load the client portal.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, requestedMode, router, workspaceId]);

  const isPreview = portalData.mode === "preview";
  const project = portalData.project || {};
  const builder = portalData.builder || {};
  const accent = builder.accentColor || "#0f766e";
  const outstandingActions = useMemo(() => buildOutstandingActions(portalData), [portalData]);
  const visibleTabs = useMemo(
    () => {
      const enabledSections = portalData.settings?.enabledSections || {};
      return PORTAL_TABS.filter((tab) => enabledSections[tab.key] !== false || isPreview);
    },
    [portalData.settings?.enabledSections, isPreview]
  );
  const unreadMessages = (portalData.messages || []).filter((message) => message.unread).length;

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key || "overview");
    }
  }, [activeTab, visibleTabs]);

  async function copyPortalLink() {
    const url = `${window.location.origin}/client-portal/${encodeURIComponent(projectId)}`;
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/client-portal");
  }

  async function refreshPortal() {
    const payload = await loadClientPortalProject({ projectId, workspaceId, mode: requestedMode });
    setPortalData(payload);
  }

  async function openSettings() {
    setSettingsOpen(true);
    setSettingsLoading(true);
    setSettingsError("");
    setInvitePreview(null);
    try {
      const [settingsPayload, auditPayload] = await Promise.all([
        loadPortalSettings({ projectId, workspaceId: project.workspaceId || workspaceId }),
        loadPortalAudit({ projectId, workspaceId: project.workspaceId || workspaceId }),
      ]);
      setSettingsState(settingsPayload);
      setAuditEvents(auditPayload.events || []);
    } catch (settingsLoadError) {
      setSettingsError(settingsLoadError.message || "Could not load portal settings.");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function sendInvitation(clientId = "") {
    setSettingsError("");
    try {
      const result = await sendPortalInvitation({ projectId, workspaceId: project.workspaceId || workspaceId, clientId });
      setInvitePreview(result.emailPreview || null);
      await refreshPortal();
      if (settingsOpen) await openSettings();
    } catch (inviteError) {
      setSettingsError(inviteError.message || "Could not send invitation.");
    }
  }

  if (loading) return <PortalState title="Loading client portal" copy="Checking access and loading shared project information." />;
  if (error) return <PortalState title="Client portal unavailable" copy={error} actionLabel="Back to Project Workspace" onAction={() => router.push("/modules/estimate-builder?page=projectDashboard")} />;

  return (
    <>
      <Head>
        <title>{project.name || "Client Portal"} | Client Portal</title>
      </Head>
      <div className="portalPage" style={{ "--accent": accent }}>
        {isPreview ? (
          <BuilderPreviewToolbar
            project={project}
            copied={copied}
            onBack={() => router.push(`/modules/estimate-builder?page=projectDashboard&organisationId=${encodeURIComponent(project.workspaceId || workspaceId || "")}`)}
            onCopy={copyPortalLink}
            onSettings={openSettings}
            onSendInvitation={() => sendInvitation(portalData.clients?.[0]?.id || "")}
            onOpenClient={() => router.push(`/client-portal/${encodeURIComponent(projectId)}`)}
          />
        ) : null}

        <header className="portalHeader">
          <div className="brandLockup">
            <div className="logoBox">
              {builder.logoUrl ? <img src={builder.logoUrl} alt="" /> : <span>{initials(builder.companyName)}</span>}
            </div>
            <div>
              <strong>{builder.companyName || "Builder"}</strong>
              <span>Client Portal</span>
            </div>
          </div>
          <div className="projectIdentity">
            <h1>{project.name || "Project"}</h1>
            <p>{[project.number, project.clientName || "Client", project.address || "Project address not published"].filter(Boolean).join(" | ")}</p>
          </div>
          <div className="accountActions">
            <span className="clientBadge">{project.clientName || "Client"}</span>
            <button type="button" onClick={logout}><LogOut size={18} />Logout</button>
          </div>
        </header>

        <nav className="portalTabs" aria-label="Client portal navigation">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === "messages" && unreadMessages ? <span className="unreadDot">{unreadMessages}</span> : null}
            </button>
          ))}
        </nav>

        <main className="portalMain">
          {activeTab === "overview" && <OverviewPage data={portalData} actions={outstandingActions} onNavigate={setActiveTab} />}
          {activeTab === "documents" && <DocumentsPage documents={portalData.documents} onNavigate={setActiveTab} />}
          {activeTab === "selections" && <SelectionsPage selections={portalData.selections} />}
          {activeTab === "variations" && <VariationsPage variations={portalData.variations} onNavigate={setActiveTab} />}
          {activeTab === "progress" && <ProgressPage data={portalData} />}
          {activeTab === "messages" && <MessagesPage messages={portalData.messages} onSend={async (message) => { await sendPortalMessage({ projectId, workspaceId: project.workspaceId || workspaceId, ...message }); await refreshPortal(); }} />}
          {activeTab === "approvals" && <ApprovalsPage approvals={portalData.approvals} project={project} onSubmit={async (payload) => { await submitPortalApproval({ projectId, workspaceId: project.workspaceId || workspaceId, ...payload }); await refreshPortal(); }} />}
        </main>

        {settingsOpen ? (
          <PortalSettingsModal
            state={settingsState}
            project={project}
            loading={settingsLoading}
            error={settingsError}
            invitePreview={invitePreview}
            auditEvents={auditEvents}
            onClose={() => setSettingsOpen(false)}
            onChange={setSettingsState}
            onCopyLink={copyPortalLink}
            onNavigateBuilder={(page) => {
              const workspaceParam = project.workspaceId || workspaceId || "";
              if (page === "documentVault") {
                router.push(`/modules/estimate-builder?page=documentVault&organisationId=${encodeURIComponent(workspaceParam)}`);
                return;
              }
              if (page === "progress") {
                router.push(`/modules/estimate-builder?page=gantt&organisationId=${encodeURIComponent(workspaceParam)}`);
                return;
              }
              if (page === "approvals") {
                router.push("/modules/builders/quote-approvals");
                return;
              }
              if (page === "photos") {
                router.push("/modules/production");
              }
            }}
            onPreview={() => router.push(`/client-portal/${encodeURIComponent(projectId)}?mode=preview&workspace_id=${encodeURIComponent(project.workspaceId || workspaceId || "")}`)}
            onSave={async (payload) => {
              setSettingsError("");
              setSettingsLoading(true);
              try {
                const saved = await savePortalSettings({ projectId, workspaceId: project.workspaceId || workspaceId, payload });
                setSettingsState(saved);
                await refreshPortal();
              } catch (saveError) {
                setSettingsError(saveError.message || "Could not save portal settings.");
              } finally {
                setSettingsLoading(false);
              }
            }}
            onSendInvitation={sendInvitation}
          />
        ) : null}
      </div>

      <style jsx global>{`
        .portalPage {
          min-height: 100vh;
          background: #f7fafc;
          color: #0f172a;
          font-size: 17px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .portalHeader {
          display: grid;
          grid-template-columns: minmax(240px, 0.7fr) minmax(300px, 1.3fr) minmax(220px, auto);
          gap: 24px;
          align-items: center;
          padding: 24px 34px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
        }
        .brandLockup,
        .accountActions,
        .portalTabs,
        .builderToolbar,
        .toolbarActions,
        .miniRow,
        .rowActions {
          display: flex;
          align-items: center;
        }
        .brandLockup { gap: 12px; min-width: 0; }
        .brandLockup strong,
        .brandLockup span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .brandLockup strong { font-size: 17px; }
        .brandLockup span,
        .projectIdentity p,
        .muted,
        .emptyState,
        .metaText {
          color: #64748b;
        }
        .logoBox {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #ffffff;
          color: var(--accent);
          font-weight: 900;
          overflow: hidden;
          flex: 0 0 auto;
        }
        .logoBox img { width: 100%; height: 100%; object-fit: contain; }
        .projectIdentity { min-width: 0; }
        h1, h2, h3, p { margin: 0; }
        h1 {
          font-size: 36px;
          line-height: 1.15;
          color: #0f172a;
        }
        .projectIdentity p {
          margin-top: 8px;
          font-size: 18px;
          line-height: 1.5;
        }
        .accountActions {
          justify-content: flex-end;
          gap: 10px;
          min-width: 0;
        }
        .clientBadge {
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border: 1px solid #dbe3ef;
          border-radius: 999px;
          padding: 8px 11px;
          font-size: 14px;
          font-weight: 800;
          color: #334155;
        }
        button {
          font: inherit;
          cursor: pointer;
        }
        .accountActions button,
        .toolbarActions button,
        .primaryButton,
        .secondaryButton,
        .linkButton {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 8px;
          font-weight: 800;
        }
        .accountActions button,
        .toolbarActions button {
          border: 1px solid #dbe3ef;
          background: #ffffff;
          color: #0f172a;
          padding: 9px 12px;
          font-size: 16px;
        }
        .builderToolbar {
          justify-content: space-between;
          gap: 16px;
          min-height: 44px;
          padding: 7px 34px;
          background: #0f172a;
          color: #ffffff;
          font-size: 15px;
        }
        .builderToolbar strong { color: #bae6fd; }
        .toolbarActions { gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .toolbarActions button {
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
          color: #ffffff;
          padding: 7px 10px;
        }
        .toolbarActions button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .portalTabs {
          gap: 6px;
          padding: 12px 34px 0;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          overflow-x: auto;
        }
        .portalTabs button {
          border: 0;
          border-bottom: 3px solid transparent;
          background: transparent;
          color: #475569;
          padding: 12px 13px;
          font-size: 17px;
          font-weight: 800;
          white-space: nowrap;
        }
        .unreadDot {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          margin-left: 8px;
          border-radius: 999px;
          background: #dc2626;
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
        }
        .portalTabs button.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }
        .portalMain {
          width: min(1280px, calc(100% - 48px));
          margin: 0 auto;
          padding: 28px 0 46px;
        }
        .gridTwo {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
          gap: 18px;
        }
        .panel,
        .quickCard,
        .tablePanel {
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        }
        .panel { padding: 22px; }
        .sectionHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }
        h2 { font-size: 26px; line-height: 1.2; color: #0f172a; }
        h3 { font-size: 20px; line-height: 1.2; color: #0f172a; }
        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .summaryItem,
        .activityItem,
        .actionItem,
        .progressItem {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 13px;
          background: #f8fafc;
        }
        .summaryItem span,
        .activityItem span,
        .progressItem span {
          display: block;
          color: #64748b;
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 5px;
        }
        .summaryItem strong,
        .activityItem strong,
        .progressItem strong {
          color: #0f172a;
          font-size: 17px;
          line-height: 1.35;
        }
        .progressBar {
          height: 12px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2e8f0;
          margin: 10px 0 12px;
        }
        .progressFill {
          height: 100%;
          width: var(--progress);
          background: var(--accent);
        }
        .actionList,
        .activityList,
        .progressList {
          display: grid;
          gap: 10px;
        }
        .actionItem {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
        }
        .actionIcon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: color-mix(in srgb, var(--accent) 12%, white);
          color: var(--accent);
        }
        .actionItem strong,
        .actionItem span {
          display: block;
        }
        .actionItem span { color: #64748b; font-size: 16px; margin-top: 3px; }
        .primaryButton,
        .secondaryButton,
        .linkButton {
          border: 0;
          background: var(--accent);
          color: #ffffff;
          padding: 10px 13px;
          font-size: 16px;
          text-decoration: none;
        }
        .secondaryButton {
          border: 1px solid #dbe3ef;
          background: #ffffff;
          color: #0f172a;
        }
        .quickGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }
        .quickCard {
          min-height: 88px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          color: #0f172a;
          text-align: left;
        }
        .quickCard svg { color: var(--accent); flex: 0 0 auto; }
        .tablePanel { overflow: hidden; }
        .tableRow {
          display: grid;
          grid-template-columns: minmax(180px, 1.3fr) 150px 110px 130px 160px;
          gap: 12px;
          align-items: center;
          padding: 14px 16px;
          border-top: 1px solid #e2e8f0;
        }
        .tableRow.header {
          border-top: 0;
          background: #f8fafc;
          color: #475569;
          font-size: 15px;
          font-weight: 900;
          text-transform: uppercase;
        }
        .badge {
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          background: #e0f2fe;
          color: #0369a1;
          padding: 5px 9px;
          font-size: 13px;
          font-weight: 850;
        }
        .rowActions { gap: 8px; justify-content: flex-end; }
        .iconButton {
          width: 36px;
          height: 36px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
        }
        .selectionGrid,
        .variationGrid,
        .approvalGrid {
          display: grid;
          gap: 14px;
        }
        .selectionCard,
        .variationCard,
        .approvalCard {
          display: grid;
          gap: 12px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #ffffff;
          padding: 16px;
        }
        .selectionCard {
          grid-template-columns: 86px minmax(0, 1fr) auto;
          align-items: center;
        }
        .productImage {
          width: 86px;
          height: 86px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          object-fit: cover;
          background: #f8fafc;
        }
        .imagePlaceholder {
          width: 86px;
          height: 86px;
          display: grid;
          place-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          color: #94a3b8;
        }
        .miniGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .miniRow { gap: 8px; color: #64748b; font-size: 16px; }
        .phaseTwo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #fed7aa;
          border-radius: 8px;
          background: #fff7ed;
          color: #9a3412;
          padding: 10px 12px;
          font-size: 16px;
          font-weight: 800;
        }
        .emptyState {
          border: 1px dashed #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          padding: 34px;
          text-align: center;
          font-size: 18px;
          line-height: 1.5;
        }
        .modalBackdrop {
          position: fixed;
          inset: 0;
          z-index: 5000;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(15, 23, 42, 0.54);
        }
        .settingsModal {
          width: min(1120px, 96vw);
          max-height: 92vh;
          overflow: auto;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #ffffff;
          padding: 24px;
          box-shadow: 0 26px 80px rgba(15, 23, 42, 0.25);
        }
        .approvalModal {
          width: min(720px, 96vw);
        }
        .settingsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .settingsSection {
          display: grid;
          gap: 12px;
          align-content: start;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #f8fafc;
          padding: 16px;
        }
        .clientEditor {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto auto;
          gap: 8px;
          align-items: center;
        }
        .formField {
          display: grid;
          gap: 7px;
          margin-top: 14px;
          color: #334155;
          font-size: 15px;
          font-weight: 850;
        }
        .formField input,
        .formField textarea,
        .clientEditor input,
        .attachmentInputs input,
        .messageComposer textarea {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          padding: 11px 12px;
          font: inherit;
          box-sizing: border-box;
        }
        .formField textarea,
        .messageComposer textarea {
          min-height: 104px;
          resize: vertical;
        }
        .checkRow {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #334155;
          font-size: 16px;
          font-weight: 750;
        }
        .checkRow input {
          width: 18px;
          height: 18px;
        }
        .contentActions,
        .messageList {
          display: grid;
          gap: 10px;
        }
        .emailPreview {
          margin-top: 16px;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          background: #f0f9ff;
          padding: 14px;
        }
        .emailPreview pre {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          color: #0f172a;
        }
        .auditSection {
          margin-top: 16px;
        }
        .auditRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          border-top: 1px solid #e2e8f0;
          padding-top: 9px;
          color: #475569;
        }
        .auditRow strong {
          color: #0f172a;
        }
        .messagePanel {
          display: grid;
          gap: 16px;
        }
        .messageBubble {
          max-width: 760px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #f8fafc;
          padding: 14px;
        }
        .messageBubble.builder {
          border-color: #bae6fd;
          background: #f0f9ff;
        }
        .messageBubble.client {
          margin-left: auto;
          border-color: #bbf7d0;
          background: #f0fdf4;
        }
        .messageBubble strong,
        .messageBubble small {
          display: block;
        }
        .messageBubble strong span,
        .messageBubble small {
          color: #64748b;
          font-size: 14px;
        }
        .messageBubble p {
          margin-top: 8px;
          line-height: 1.55;
        }
        .attachmentList {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .attachmentList a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          padding: 7px 9px;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
        }
        .replyButton {
          margin-top: 9px;
          padding: 7px 10px;
          font-size: 14px;
        }
        .replyContext {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          grid-column: 1 / -1;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          background: #f0f9ff;
          color: #0f172a;
          padding: 9px 11px;
          font-size: 15px;
          font-weight: 800;
        }
        .replyContext button {
          border: 0;
          background: transparent;
          color: #0369a1;
          font-weight: 900;
        }
        .attachmentInputs {
          display: grid;
          grid-template-columns: minmax(150px, 0.7fr) minmax(220px, 1.3fr);
          gap: 10px;
          grid-column: 1 / -1;
        }
        .messageComposer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: end;
        }
        .formError {
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fff1f2;
          color: #991b1b;
          padding: 10px 12px;
          font-weight: 800;
        }
        .modalActions,
        .approvalActions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dangerButton {
          border-color: #fecaca;
          color: #991b1b;
          background: #fff1f2;
        }
        @media (max-width: 940px) {
          .portalHeader,
          .gridTwo,
          .quickGrid,
          .summaryGrid {
            grid-template-columns: 1fr;
          }
          .accountActions { justify-content: flex-start; }
          .tableRow {
            grid-template-columns: 1fr;
            gap: 6px;
          }
          .tableRow.header { display: none; }
          .rowActions { justify-content: flex-start; }
          .selectionCard { grid-template-columns: 86px minmax(0, 1fr); }
          .selectionCard .badge { grid-column: 1 / -1; }
          .builderToolbar {
            align-items: flex-start;
            flex-direction: column;
          }
          .toolbarActions { justify-content: flex-start; }
          .settingsGrid,
          .clientEditor,
          .attachmentInputs,
          .messageComposer {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function BuilderPreviewToolbar({ project, copied, onBack, onCopy, onSettings, onSendInvitation, onOpenClient }) {
  return (
    <div className="builderToolbar">
      <button type="button" onClick={onBack}>Back to Project Workspace</button>
      <span>Previewing as: <strong>{project.clientName || "Client"}</strong></span>
      <div className="toolbarActions">
        <button type="button" onClick={onSettings}><Settings size={16} />Portal settings</button>
        <button type="button" onClick={onCopy}>{copied ? "Copied" : "Copy client portal link"}</button>
        <button type="button" onClick={onSendInvitation}><Send size={16} />Send invitation</button>
        <button type="button" onClick={onOpenClient}>Open client view</button>
      </div>
    </div>
  );
}

function OverviewPage({ data, actions, onNavigate }) {
  const project = data.project || {};
  const progress = Math.max(0, Math.min(100, averageProgress(data.progress)));
  const recent = [
    data.progress[0] && `Latest progress update: ${data.progress[0].title}`,
    data.documents[0] && `Recently uploaded document: ${data.documents[0].name}`,
    data.selections[0] && `Selection submitted: ${data.selections[0].category}`,
    data.variations[0] && `Variation issued: ${data.variations[0].title}`,
  ].filter(Boolean);

  return (
    <div>
      <div className="gridTwo">
        <section className="panel">
          <div className="sectionHeader">
            <div>
              <h2>Project Summary</h2>
              <p className="muted">Published details for this client project.</p>
            </div>
            <span className="badge">{project.stage || "Pre-construction"}</span>
          </div>
          <div className="summaryGrid">
            <SummaryItem label="Project name" value={project.name} />
            <SummaryItem label="Project number" value={project.number || "Not published"} />
            <SummaryItem label="Site address" value={project.address} />
            <SummaryItem label="Commencement" value={project.commencementDate || "Not published"} />
            <SummaryItem label="Estimated completion" value={project.estimatedCompletionDate || "Not published"} />
            <SummaryItem label="Primary contact" value={project.supervisor || "Not published"} />
            <SummaryItem label="Builder contact" value={project.builderContact || "Not published"} />
          </div>
        </section>

        <section className="panel">
          <div className="sectionHeader">
            <div>
              <h2>Progress</h2>
              <p className="muted">Simplified client-facing progress only.</p>
            </div>
            <span className="badge">{progress}% complete</span>
          </div>
          <div className="progressBar"><div className="progressFill" style={{ "--progress": `${progress}%` }} /></div>
          <SummaryItem label="Current stage" value={project.stage || "Not published"} />
          <SummaryItem label="Next milestone" value={data.progress[0]?.title || "No published milestone yet"} />
          <SummaryItem label="Last updated" value={project.updatedAt || "Not published"} />
        </section>
      </div>

      {actions.length ? (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="sectionHeader">
            <div>
              <h2>Action Required</h2>
              <p className="muted">Items waiting on the client.</p>
            </div>
          </div>
          <div className="actionList">
            {actions.map((action) => (
              <button key={`${action.type}-${action.id}`} type="button" className="actionItem" onClick={() => onNavigate(action.tab)}>
                <span className="actionIcon"><Clock3 size={18} /></span>
                <span><strong>{action.title}</strong><span>{action.description}</span></span>
                <span className="primaryButton">Open</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="quickGrid">
        {[
          ["View Project Estimate", "documents"],
          ["Continue Selections", "selections"],
          ["Review Variations", "variations"],
          ["View Progress", "progress"],
          ["View Documents", "documents"],
          ["Contact Builder", "messages"],
        ].map(([label, tab]) => (
          <button key={label} type="button" className="quickCard" onClick={() => onNavigate(tab)}>
            <strong>{label}</strong><ExternalLink size={18} />
          </button>
        ))}
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="sectionHeader"><h2>Recent Activity</h2></div>
        {recent.length ? (
          <div className="activityList">
            {recent.map((item) => <div key={item} className="activityItem"><strong>{item}</strong></div>)}
          </div>
        ) : <EmptyState copy="No client-visible activity has been published yet." />}
      </section>
    </div>
  );
}

function DocumentsPage({ documents, onNavigate }) {
  if (!documents.length) return <EmptyState copy="No documents have been marked visible in the Client Portal yet." />;
  return (
    <section className="tablePanel">
      <div className="tableRow header">
        <span>Document</span><span>Category</span><span>Version</span><span>Status</span><span>Actions</span>
      </div>
      {documents.map((document) => (
        <div key={document.id} className="tableRow">
          <strong>{document.name}<span className="metaText">Issued {document.issuedDate || "date not published"}</span></strong>
          <span>{document.category}</span>
          <span>{document.version}</span>
          <span className="badge">{document.status}</span>
          <span className="rowActions">
            {document.viewUrl ? <a className="iconButton" href={document.viewUrl} target="_blank" rel="noreferrer" aria-label="View document"><ExternalLink size={18} /></a> : null}
            {document.downloadUrl ? <a className="iconButton" href={document.downloadUrl} download aria-label="Download document"><Download size={18} /></a> : null}
            {document.requiresApproval ? <button type="button" className="secondaryButton" onClick={() => onNavigate("approvals")}>Review approval</button> : null}
          </span>
        </div>
      ))}
    </section>
  );
}

function SelectionsPage({ selections }) {
  if (!selections.length) return <EmptyState copy="No selections are currently published for client review." />;
  return (
    <div className="selectionGrid">
      {selections.map((selection) => (
        <article key={selection.id} className="selectionCard">
          {selection.imageUrl ? <img className="productImage" src={selection.imageUrl} alt="" /> : <span className="imagePlaceholder"><FileText size={24} /></span>}
          <div>
            <h3>{selection.category}</h3>
            <p className="muted">{selection.selectedProduct}</p>
            <div className="miniGrid">
              <span className="miniRow">Supplier: {selection.supplier || "Not published"}</span>
              <span className="miniRow">Finish: {selection.colourFinish || "Not selected"}</span>
              <span className="miniRow">Due: {selection.dueDate || "Not set"}</span>
            </div>
            {selection.builderNotes ? <p className="muted">Builder note: {selection.builderNotes}</p> : null}
          </div>
          <span className="badge">{selection.status}</span>
        </article>
      ))}
    </div>
  );
}

function VariationsPage({ variations, onNavigate }) {
  if (!variations.length) return <EmptyState copy="No client-visible variations have been issued." />;
  return (
    <div className="variationGrid">
      {variations.map((variation) => (
        <article key={variation.id} className="variationCard">
          <div className="sectionHeader">
            <div>
              <h3>{variation.number ? `${variation.number}: ` : ""}{variation.title}</h3>
              <p className="muted">{variation.description || "No client description published."}</p>
            </div>
            <span className="badge">{variation.status}</span>
          </div>
          <div className="summaryGrid">
            <SummaryItem label="Date issued" value={variation.dateIssued || "Not published"} />
            <SummaryItem label="Price including GST" value={variation.priceIncludingGst || "Not published"} />
            <SummaryItem label="Time impact" value={variation.timeImpact} />
            <SummaryItem label="Response deadline" value={variation.responseDeadline || "Not set"} />
          </div>
          <button type="button" className="secondaryButton" onClick={() => onNavigate("approvals")}>Review in Approvals</button>
        </article>
      ))}
    </div>
  );
}

function ProgressPage({ data }) {
  if (!data.progress.length) return <EmptyState copy="No client-visible progress updates have been published yet." />;
  return (
    <section className="panel">
      <div className="sectionHeader"><h2>Progress Updates</h2><span className="badge">{averageProgress(data.progress)}% overall</span></div>
      <div className="progressList">
        {data.progress.map((item) => (
          <div key={item.id} className="progressItem">
            <span>{item.stage || item.status || "Project update"}</span>
            <strong>{item.title}</strong>
            {item.update ? <p className="muted">{item.update}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function MessagesPage({ messages = [], onSend }) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    const attachments = attachmentUrl.trim()
      ? [{ name: attachmentName.trim() || attachmentUrl.trim(), url: attachmentUrl.trim() }]
      : [];
    setSending(true);
    setError("");
    try {
      await onSend({ body: draft.trim(), parentMessageId: replyTo?.id || "", attachments });
      setDraft("");
      setReplyTo(null);
      setAttachmentName("");
      setAttachmentUrl("");
    } catch (sendError) {
      setError(sendError.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="panel messagePanel">
      <div className="sectionHeader">
        <div>
          <h2>Project Messages</h2>
          <p className="muted">Messages stay attached to this project and do not include internal team notes.</p>
        </div>
      </div>
      <div className="messageList">
        {messages.length ? messages.map((message) => (
          <article key={message.id} className={`messageBubble ${message.senderRole}`}>
            <strong>{message.senderName} <span>{message.senderRole === "builder" ? "Builder" : "Client"}</span></strong>
            <p>{message.body}</p>
            {message.attachments?.length ? (
              <div className="attachmentList">
                {message.attachments.map((attachment, index) => (
                  <a key={`${message.id}-attachment-${index}`} href={attachment.url} target="_blank" rel="noreferrer">
                    <FileText size={15} />{attachment.name || "Attachment"}
                  </a>
                ))}
              </div>
            ) : null}
            <small>{message.createdAt || "Just now"}</small>
            <button type="button" className="linkButton replyButton" onClick={() => setReplyTo(message)}>Reply</button>
          </article>
        )) : <EmptyState copy="No project messages yet. Start the conversation below." />}
      </div>
      <form className="messageComposer" onSubmit={submit}>
        {replyTo ? (
          <div className="replyContext">
            Replying to {replyTo.senderName}
            <button type="button" onClick={() => setReplyTo(null)}>Clear</button>
          </div>
        ) : null}
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a project message..." />
        <div className="attachmentInputs">
          <input value={attachmentName} onChange={(event) => setAttachmentName(event.target.value)} placeholder="Attachment name" />
          <input value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} placeholder="Attachment URL" />
        </div>
        <button type="submit" className="primaryButton" disabled={sending || !draft.trim()}>{sending ? "Sending..." : "Send message"}</button>
      </form>
      {error ? <p className="formError">{error}</p> : null}
    </section>
  );
}

function ApprovalsPage({ approvals, project, onSubmit }) {
  const [activeApproval, setActiveApproval] = useState(null);
  if (!approvals.length) return <EmptyState copy="There are no client approvals waiting right now." />;
  return (
    <>
      <div className="approvalGrid">
        {approvals.map((approval) => {
          const final = ["approved", "rejected", "changes_requested"].includes(String(approval.status).toLowerCase());
          return (
            <article key={approval.id} className="approvalCard">
              <div className="sectionHeader">
                <div>
                  <h3>{approval.item}</h3>
                  <p className="muted">{approval.type} | issued {approval.dateIssued || "date not published"} | due {approval.dueDate || "not set"}</p>
                </div>
                <span className="badge">{approval.status}</span>
              </div>
              <div className="rowActions approvalActions">
                {approval.viewUrl ? <a className="secondaryButton" href={approval.viewUrl} target="_blank" rel="noreferrer">View item</a> : null}
                <button type="button" className="primaryButton" disabled={final} onClick={() => setActiveApproval({ ...approval, action: "approved" })}>Approve</button>
                <button type="button" className="secondaryButton" disabled={final} onClick={() => setActiveApproval({ ...approval, action: "changes_requested" })}>Request changes</button>
                {approval.allowReject !== false ? (
                  <button type="button" className="secondaryButton dangerButton" disabled={final} onClick={() => setActiveApproval({ ...approval, action: "rejected" })}>Reject</button>
                ) : null}
              </div>
              {approval.respondedAt ? <p className="muted">Responded by {approval.responseName || "client"} on {approval.respondedAt}</p> : null}
            </article>
          );
        })}
      </div>
      {activeApproval ? (
        <ApprovalConfirmModal
          approval={activeApproval}
          project={project}
          onClose={() => setActiveApproval(null)}
          onSubmit={async (payload) => {
            await onSubmit(payload);
            setActiveApproval(null);
          }}
        />
      ) : null}
    </>
  );
}

function ApprovalConfirmModal({ approval, project, onClose, onSubmit }) {
  const [comment, setComment] = useState("");
  const [clientName, setClientName] = useState(project.clientName || "");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const actionLabel = approval.action === "approved" ? "Approve" : approval.action === "rejected" ? "Reject" : "Request changes";

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await onSubmit({ approvalId: approval.id, action: approval.action, comment, clientName, confirmed });
    } catch (submitError) {
      setError(submitError.message || "Could not submit approval response.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="settingsModal approvalModal">
        <div className="sectionHeader">
          <div>
            <h2>Confirm {actionLabel}</h2>
            <p className="muted">Review exactly what you are responding to before submitting.</p>
          </div>
          <button type="button" className="secondaryButton" onClick={onClose}>Close</button>
        </div>
        <div className="summaryGrid">
          <SummaryItem label="Project" value={project.name} />
          <SummaryItem label="Client" value={project.clientName} />
          <SummaryItem label="Item" value={approval.item} />
          <SummaryItem label="Response" value={actionLabel} />
        </div>
        <label className="formField">
          Client name
          <input value={clientName} onChange={(event) => setClientName(event.target.value)} />
        </label>
        <label className="formField">
          Comment
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional comment for the builder" />
        </label>
        <label className="checkRow">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>I confirm this response is accurate and final.</span>
        </label>
        {error ? <p className="formError">{error}</p> : null}
        <div className="modalActions">
          <button type="button" className="secondaryButton" onClick={onClose}>Cancel</button>
          <button type="button" className="primaryButton" disabled={saving || !confirmed} onClick={submit}>{saving ? "Submitting..." : actionLabel}</button>
        </div>
      </section>
    </div>
  );
}

function PortalSettingsModal({ state, project, loading, error, invitePreview, auditEvents, onClose, onChange, onCopyLink, onNavigateBuilder, onPreview, onSave, onSendInvitation }) {
  const settings = state?.settings || {};
  const clients = state?.clients || [];
  const draft = {
    portalEnabled: settings.portal_enabled ?? settings.portalEnabled ?? false,
    accessSuspended: settings.access_suspended ?? settings.accessSuspended ?? false,
    status: settings.status || "not_set_up",
    enabledSections: settings.enabled_sections || settings.enabledSections || {},
    visibility: settings.visibility || {},
    branding: settings.branding || {},
    content: settings.content || {},
    clients,
  };

  function update(next) {
    onChange({ ...(state || {}), settings: { ...settings, ...next }, clients: next.clients || clients });
  }

  function setNested(group, key, value) {
    update({ [group]: { ...(draft[group] || {}), [key]: value } });
  }

  function updateClient(index, patch) {
    update({ clients: clients.map((client, i) => i === index ? { ...client, ...patch } : client) });
  }

  function addClient() {
    update({ clients: [...clients, { client_name: "", client_email: "", status: "invitation_not_sent" }] });
  }

  function removeClient(index) {
    update({ clients: clients.filter((_, i) => i !== index) });
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <section className="settingsModal">
        <div className="sectionHeader">
          <div>
            <h2>Portal Settings</h2>
            <p className="muted">Settings are saved against {project.name || "this project"}.</p>
          </div>
          <button type="button" className="secondaryButton" onClick={onClose}>Close</button>
        </div>
        {loading && !state ? <EmptyState copy="Loading portal settings..." /> : (
          <div className="settingsGrid">
            <section className="settingsSection">
              <h3>Portal Access</h3>
              <label className="checkRow"><input type="checkbox" checked={draft.portalEnabled} onChange={(event) => update({ portal_enabled: event.target.checked, portalEnabled: event.target.checked })} />Enable Client Portal</label>
              <label className="checkRow"><input type="checkbox" checked={draft.accessSuspended} onChange={(event) => update({ access_suspended: event.target.checked, accessSuspended: event.target.checked })} />Access suspended</label>
              <SummaryItem label="Portal status" value={humanStatus(draft.status)} />
              <button type="button" className="secondaryButton" onClick={onCopyLink}>Copy secure portal link</button>
              {clients.map((client, index) => (
                <div className="clientEditor" key={client.id || index}>
                  <input value={client.client_name || client.name || ""} placeholder="Client name" onChange={(event) => updateClient(index, { client_name: event.target.value, name: event.target.value })} />
                  <input value={client.client_email || client.email || ""} placeholder="Client email" onChange={(event) => updateClient(index, { client_email: event.target.value, email: event.target.value })} />
                  <button type="button" className="secondaryButton" onClick={() => onSendInvitation(client.id)}>{client.last_invitation_sent_at || client.lastInvitationSentAt ? "Resend invitation" : "Send invitation"}</button>
                  <button type="button" className="secondaryButton dangerButton" onClick={() => removeClient(index)}>Remove</button>
                </div>
              ))}
              <button type="button" className="secondaryButton" onClick={addClient}>Add another client</button>
              <SummaryItem label="Last invitation" value={settings.last_invitation_sent_at || settings.lastInvitationSentAt || "Not yet sent"} />
              <SummaryItem label="Last client login" value={settings.last_client_login_at || settings.lastClientLoginAt || "Not yet recorded"} />
            </section>

            <section className="settingsSection">
              <h3>Visible Portal Sections</h3>
              {PORTAL_TABS.map((tab) => (
                <label key={tab.key} className="checkRow"><input type="checkbox" checked={draft.enabledSections[tab.key] !== false} onChange={(event) => setNested("enabledSections", tab.key, event.target.checked)} />{tab.label}</label>
              ))}
            </section>

            <section className="settingsSection">
              <h3>Project Information Visibility</h3>
              {[
                ["commencementDate", "Show estimated commencement date"],
                ["completionDate", "Show estimated completion date"],
                ["progressPercentage", "Show project progress percentage"],
                ["currentStage", "Show current construction stage"],
                ["upcomingMilestones", "Show upcoming milestones"],
                ["supervisorDetails", "Show supervisor details"],
                ["projectEstimate", "Show project estimate"],
                ["formalQuote", "Show formal quote"],
                ["contractValue", "Show contract value"],
                ["progressPayments", "Show progress payment information"],
              ].map(([key, label]) => (
                <label key={key} className="checkRow"><input type="checkbox" checked={draft.visibility[key] === true} onChange={(event) => setNested("visibility", key, event.target.checked)} />{label}</label>
              ))}
            </section>

            <section className="settingsSection">
              <h3>Content Management</h3>
              <div className="contentActions">
                <button type="button" className="secondaryButton" onClick={() => onNavigateBuilder("documentVault")}>Manage shared documents</button>
                <button type="button" className="secondaryButton" onClick={() => onNavigateBuilder("progress")}>Manage client-visible progress updates</button>
                <button type="button" className="secondaryButton" onClick={() => onNavigateBuilder("photos")}>Manage client-visible photos</button>
                <button type="button" className="secondaryButton" onClick={() => onNavigateBuilder("approvals")}>Manage outstanding client actions</button>
                <button type="button" className="secondaryButton" onClick={onPreview}>Preview client portal</button>
              </div>
            </section>
          </div>
        )}

        {invitePreview ? (
          <details className="emailPreview" open>
            <summary>Development email preview</summary>
            <pre>{invitePreview.text}</pre>
            <a href={invitePreview.activationUrl} target="_blank" rel="noreferrer">{invitePreview.activationUrl}</a>
          </details>
        ) : null}

        <section className="settingsSection auditSection">
          <h3>Audit History</h3>
          {auditEvents.length ? auditEvents.map((event) => (
            <div className="auditRow" key={event.id}><strong>{event.action}</strong><span>{event.user_role} | {event.created_at}</span></div>
          )) : <p className="muted">No audit events recorded yet.</p>}
        </section>

        {error ? <p className="formError">{error}</p> : null}
        <div className="modalActions">
          <button type="button" className="secondaryButton" onClick={onClose}>Cancel</button>
          <button type="button" className="primaryButton" disabled={loading} onClick={() => onSave(draft)}>{loading ? "Saving..." : "Save settings"}</button>
        </div>
      </section>
    </div>
  );
}

function humanStatus(status = "") {
  return String(status || "not_set_up").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function SummaryItem({ label, value }) {
  return <div className="summaryItem"><span>{label}</span><strong>{value || "Not published"}</strong></div>;
}

function EmptyState({ copy }) {
  return <div className="emptyState">{copy}</div>;
}

function PortalState({ title, copy, actionLabel, onAction }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7fafc", padding: 24 }}>
      <section style={{ width: "min(620px, 100%)", background: "#fff", border: "1px solid #dbe3ef", borderRadius: 8, padding: 26, color: "#0f172a" }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <p style={{ margin: "10px 0 0", color: "#64748b", lineHeight: 1.6 }}>{copy}</p>
        {actionLabel ? <button type="button" style={{ marginTop: 18, border: 0, borderRadius: 8, background: "#0f172a", color: "#fff", padding: "11px 14px", fontWeight: 800 }} onClick={onAction}>{actionLabel}</button> : null}
      </section>
    </main>
  );
}

function buildOutstandingActions(data) {
  return [
    ...data.selections.filter((item) => ["Not Started", "In Progress", "Changes Requested"].includes(item.status)).map((item) => ({
      id: item.id,
      type: "selection",
      title: item.category,
      description: "Selection requires client review.",
      tab: "selections",
    })),
    ...data.variations.filter((item) => item.status === "Awaiting Client Approval").map((item) => ({
      id: item.id,
      type: "variation",
      title: item.title,
      description: "Variation awaiting client approval.",
      tab: "variations",
    })),
    ...data.approvals.filter((item) => ["pending", "sent"].includes(String(item.status).toLowerCase())).map((item) => ({
      id: item.id,
      type: "approval",
      title: item.item,
      description: "Approval or signature required.",
      tab: "approvals",
    })),
  ];
}

function averageProgress(progressRows) {
  if (!progressRows.length) return 0;
  const total = progressRows.reduce((sum, row) => sum + Number(row.progress || 0), 0);
  return Math.round(total / progressRows.length);
}

function initials(value = "") {
  return String(value || "Builder")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "B";
}
