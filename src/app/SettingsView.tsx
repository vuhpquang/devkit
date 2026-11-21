import { useMemo, useState, type ReactNode } from "react";
import { Info, LayoutGrid, RefreshCw, Search, SlidersHorizontal, Type, type LucideIcon } from "lucide-react";
import { tools, CATEGORY_ORDER } from "../tools/registry";
import { Badge, Button, IconTile, Segmented, Select, Switch, TextInput, cx } from "../lib/ui";
import { AboutContent, Sheet, UpdateActionButton, UpdateStatusLabel } from "./About";
import { ReleaseNotes } from "./WhatsNew";
import { FONT_SIZES, useSettings, type SidebarMode, type Startup } from "./settings";
import { useTheme, type Theme } from "./theme";
import { useUpdater } from "./updater";
import { noteBlocks } from "./updates";
import { searchTools } from "./search";

export type PaneId = "general" | "tools" | "editor" | "updates" | "about";

/** App's own panes first (General first), then Updates, then About — app-shell's order. */
const PANES: { id: PaneId; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "tools", label: "Tools", icon: LayoutGrid },
  { id: "editor", label: "Editor", icon: Type },
  { id: "updates", label: "Updates", icon: RefreshCw },
  { id: "about", label: "About", icon: Info },
];

/* ------------------------------------------------------------ Form bits */

function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-5">
      {title && <h3 className="text-sm font-semibold text-fg-muted mb-1.5 px-1">{title}</h3>}
      <div className="rounded-lg border border-line bg-surface divide-y divide-line">{children}</div>
      {footer && <p className="text-sm text-fg-faint mt-1.5 px-1">{footer}</p>}
    </section>
  );
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 min-h-11 px-3.5 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-base text-fg">{label}</div>
        {hint && <div className="text-sm text-fg-faint mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0 flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Panes */

function GeneralPane() {
  const { settings, update, reset } = useSettings();
  const { theme, setTheme } = useTheme();
  return (
    <>
      <Section title="Appearance">
        <Row label="Theme">
          <Segmented<Theme>
            label="Theme"
            size="sm"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Row>
      </Section>
      <Section
        title="Window"
        footer={
          settings.sidebar === "autohide"
            ? "Move the pointer to the left edge of the window to bring the sidebar in."
            : "⌃⌘S or the sidebar button shows and hides it."
        }
      >
        <Row label="Sidebar">
          <Segmented<SidebarMode>
            label="Sidebar"
            size="sm"
            value={settings.sidebar}
            onChange={(sidebar) => update({ sidebar })}
            options={[
              { value: "shown", label: "Shown" },
              { value: "hidden", label: "Hidden" },
              { value: "autohide", label: "Auto-hide" },
            ]}
          />
        </Row>
        <Row label="On launch, open">
          <Segmented<Startup>
            label="On launch, open"
            size="sm"
            value={settings.startup}
            onChange={(startup) => update({ startup })}
            options={[
              { value: "last", label: "Last tool" },
              { value: "home", label: "All tools" },
            ]}
          />
        </Row>
      </Section>
      <Section>
        <Row label="Reset all settings" hint="Theme, favorites and recent tools are kept.">
          <Button size="sm" onClick={reset}>
            Reset
          </Button>
        </Row>
      </Section>
    </>
  );
}

function ToolsPane() {
  const { settings, update } = useSettings();
  const [q, setQ] = useState("");
  const list = useMemo(() => searchTools(tools, q), [q]);
  const hidden = new Set(settings.hiddenTools);
  const shownCount = tools.filter((t) => !hidden.has(t.id) && (settings.showOnlineTools || !t.online)).length;
  const setHidden = (id: string, hide: boolean) =>
    update({ hiddenTools: hide ? [...settings.hiddenTools.filter((x) => x !== id), id] : settings.hiddenTools.filter((x) => x !== id) });

  return (
    <>
      <Section footer="Off: DevKit never touches the network, and online tools disappear from ⌘K too.">
        <Row label="Online tools" hint="WHOIS, DNS, IP info, npm, currency">
          <Switch label="Online tools" checked={settings.showOnlineTools} onChange={(showOnlineTools) => update({ showOnlineTools })} />
        </Row>
      </Section>
      <div className="flex items-center gap-2 mb-3">
        <TextInput icon={Search} placeholder="Filter tools…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" aria-label="Filter tools" />
        <span className="text-sm text-fg-faint tabular-nums whitespace-nowrap">
          {shownCount} of {tools.length} in the sidebar
        </span>
        <Button size="sm" disabled={settings.hiddenTools.length === 0} onClick={() => update({ hiddenTools: [] })}>
          Show all
        </Button>
      </div>
      {CATEGORY_ORDER.map((cat) => {
        const items = list.filter((t) => t.category === cat);
        if (!items.length) return null;
        return (
          <Section key={cat} title={cat}>
            {items.map((t) => {
              const offline = t.online && !settings.showOnlineTools;
              return (
                <Row
                  key={t.id}
                  label={
                    <span className="flex items-center gap-2.5">
                      <IconTile icon={t.icon} size={24} />
                      <span className="truncate">{t.name}</span>
                      {t.online && <Badge tone="info">Online</Badge>}
                    </span>
                  }
                >
                  <Switch label={`Show ${t.name}`} checked={!hidden.has(t.id) && !offline} disabled={offline} onChange={(on) => setHidden(t.id, !on)} />
                </Row>
              );
            })}
          </Section>
        );
      })}
      <p className="text-sm text-fg-faint px-1">Hidden tools stay one ⌘K away.</p>
    </>
  );
}

function EditorPane() {
  const { settings, update } = useSettings();
  return (
    <>
      <Section title="Text">
        <Row label="Font size">
          <Select
            aria-label="Font size"
            value={settings.editorFontSize}
            onChange={(e) => update({ editorFontSize: Number(e.target.value) })}
            className="w-24"
          >
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} pt
              </option>
            ))}
          </Select>
        </Row>
        <div className="px-3.5 py-3">
          <pre
            className="rounded-md bg-surface-2 border border-line px-3 py-2 font-mono text-fg overflow-hidden"
            style={{ fontSize: settings.editorFontSize, lineHeight: 1.65 }}
          >
            <span style={{ color: "var(--syn-punct)" }}>{"{ "}</span>
            <span style={{ color: "var(--syn-key)" }}>"tool"</span>
            <span style={{ color: "var(--syn-punct)" }}>: </span>
            <span style={{ color: "var(--syn-string)" }}>"DevKit"</span>
            <span style={{ color: "var(--syn-punct)" }}>, </span>
            <span style={{ color: "var(--syn-key)" }}>"size"</span>
            <span style={{ color: "var(--syn-punct)" }}>: </span>
            <span style={{ color: "var(--syn-number)" }}>{settings.editorFontSize}</span>
            <span style={{ color: "var(--syn-punct)" }}>{" }"}</span>
          </pre>
        </div>
      </Section>
      <Section title="Defaults" footer="Each tool can still switch line wrapping from its toolbar.">
        <Row label="Wrap long lines">
          <Switch label="Wrap long lines" checked={settings.wrapLines} onChange={(wrapLines) => update({ wrapLines })} />
        </Row>
        <Row label="Line numbers">
          <Switch label="Line numbers" checked={settings.lineNumbers} onChange={(lineNumbers) => update({ lineNumbers })} />
        </Row>
      </Section>
    </>
  );
}

function UpdatesPane() {
  const { settings, update } = useSettings();
  const { state, lastChecked, check } = useUpdater();
  return (
    <>
      <Section footer={lastChecked ? `Last checked ${lastChecked.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : undefined}>
        <Row label={<UpdateStatusLabel state={state} />}>
          <UpdateActionButton state={state} onCheck={() => void check(true)} />
        </Row>
      </Section>
      {state.kind === "available" && state.release.notes && (
        <Section title={`What's new in ${state.release.version}`}>
          <div className="px-4 py-3 max-h-56 overflow-y-auto">
            <ReleaseNotes blocks={noteBlocks(state.release.notes)} />
          </div>
        </Section>
      )}
      <Section footer="DevKit only checks. App Depot downloads and installs new versions for you.">
        <Row label="Check for updates automatically">
          <Switch
            label="Check for updates automatically"
            checked={settings.autoCheckUpdates}
            onChange={(autoCheckUpdates) => update({ autoCheckUpdates })}
          />
        </Row>
        <Row label="Install updates automatically" hint="Managed by App Depot">
          <Switch label="Install updates automatically" checked={false} disabled onChange={() => {}} />
        </Row>
      </Section>
    </>
  );
}

/* --------------------------------------------------------------- Window */

export function SettingsView({
  open,
  pane,
  onPane,
  onClose,
  onWhatsNew,
}: {
  open: boolean;
  pane: PaneId;
  onPane: (p: PaneId) => void;
  onClose: () => void;
  onWhatsNew: () => void;
}) {
  if (!open) return null;
  const current = PANES.find((p) => p.id === pane) ?? PANES[0];
  return (
    <Sheet label="Settings" onClose={onClose} className="w-[780px] h-[580px] flex overflow-hidden">
      <nav aria-label="Settings" className="w-[190px] shrink-0 bg-sidebar border-r border-line p-2 pt-4 flex flex-col gap-px">
        <div className="px-2.5 pb-3 text-md font-semibold text-fg">Settings</div>
        {PANES.map((p) => {
          const on = p.id === current.id;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => onPane(p.id)}
              className={cx(
                "h-8 flex items-center gap-2.5 px-2.5 rounded-md text-base text-left outline-none focus-visible:ring-2 focus-visible:ring-accent-ring",
                on ? "bg-accent-soft text-fg font-medium" : "text-fg-muted hover:bg-surface-3/70 hover:text-fg",
              )}
            >
              <Icon size={16} className={on ? "text-accent-text" : "text-fg-faint"} aria-hidden />
              {p.label}
            </button>
          );
        })}
      </nav>
      <div className="flex-1 min-w-0 flex flex-col bg-canvas">
        <h2 className="shrink-0 h-12 flex items-center px-6 text-lg font-semibold text-fg border-b border-line">{current.label}</h2>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {current.id === "general" && <GeneralPane />}
          {current.id === "tools" && <ToolsPane />}
          {current.id === "editor" && <EditorPane />}
          {current.id === "updates" && <UpdatesPane />}
          {current.id === "about" && (
            <div className="pt-2">
              <AboutContent onWhatsNew={onWhatsNew} />
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
