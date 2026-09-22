import { ArrowRight, Clock, FileCode, FilePlus2, FileText, FolderOpen, Settings, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale, MessageKey } from "../lib/i18n";
import { t } from "../lib/i18n";
import { formatShortcut, getShortcutMap } from "../lib/shortcuts";

interface Props {
  locale: Locale;
  recentFiles: string[];
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onOpenSample: () => void;
  onOpenRecent: (path: string) => void;
  onOpenSettings: () => void;
}

interface QuickAction {
  tone: "new" | "folder" | "file" | "sample";
  icon: LucideIcon;
  title: MessageKey;
  desc: MessageKey;
  run: () => void;
}

function getFileName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

function getParentFolder(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return "";
}

export default function WelcomePanel({
  locale,
  recentFiles,
  onNew,
  onOpen,
  onOpenFolder,
  onOpenSample,
  onOpenRecent,
  onOpenSettings,
}: Props) {
  const tr = (key: MessageKey) => t(locale, key);

  const quickActions: QuickAction[] = [
    { tone: "new", icon: FilePlus2, title: "welcome.new", desc: "welcome.newDesc", run: onNew },
    { tone: "folder", icon: FolderOpen, title: "welcome.openFolder", desc: "welcome.openFolderDesc", run: onOpenFolder },
    { tone: "file", icon: FileText, title: "welcome.open", desc: "welcome.openDesc", run: onOpen },
    { tone: "sample", icon: Sparkles, title: "welcome.sample", desc: "welcome.sampleDesc", run: onOpenSample },
  ];

  const recentItems = recentFiles.slice(0, 5);

  return (
    <div className="welcome-panel">
      {/* Obsidian Glass 环境光晕背景 */}
      <div className="welcome-glow welcome-glow-1" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-2" aria-hidden="true" />

      <div className="welcome-container welcome-animate-in">
        {/* 头部品牌标语 */}
        <header className="welcome-header">
          <div className="welcome-brand-mark" aria-hidden="true">
            <span className="welcome-brand-glyph">✦</span>
          </div>
          <h1 className="welcome-title">{tr("welcome.title")}</h1>
          <p className="welcome-desc">{tr("welcome.desc")}</p>
        </header>

        {/* 2x2 快捷创作卡片网格 */}
        <section className="welcome-section" aria-label={tr("welcome.quickActions")}>
          <div className="welcome-grid">
            {quickActions.map(({ tone, icon: Icon, title, desc, run }) => (
              <button
                key={tone}
                type="button"
                className={`welcome-card welcome-card--${tone}`}
                onClick={run}
              >
                <div className={`welcome-card-icon welcome-card-icon--${tone}`} aria-hidden="true">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div className="welcome-card-body">
                  <div className="welcome-card-title">{tr(title)}</div>
                  <div className="welcome-card-desc">{tr(desc)}</div>
                </div>
                <ArrowRight size={16} className="welcome-card-arrow" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        {/* 最近文档卡片流（含空数据态） */}
        <section className="welcome-section welcome-recent-section">
          <div className="welcome-recent-header">
            <div className="welcome-recent-title-wrap">
              <Clock size={13} className="welcome-recent-icon" aria-hidden="true" />
              <h2 className="welcome-recent-title">{tr("welcome.recent")}</h2>
            </div>
          </div>
          {recentItems.length > 0 ? (
            <ul className="welcome-recent-list">
              {recentItems.map((path) => {
                const fileName = getFileName(path);
                const parent = getParentFolder(path);
                return (
                  <li key={path}>
                    <button
                      type="button"
                      className="welcome-recent-item"
                      onClick={() => onOpenRecent(path)}
                      title={path}
                    >
                      <div className="welcome-recent-item-left">
                        <FileCode size={15} className="welcome-recent-item-icon" aria-hidden="true" />
                        <span className="welcome-recent-name">{fileName}</span>
                        {parent && <span className="welcome-recent-badge">{parent}</span>}
                      </div>
                      <span className="welcome-recent-action" aria-hidden="true">
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="welcome-recent-empty">{tr("welcome.emptyRecent")}</p>
          )}
        </section>

        {/* 底部状态与偏好设置 */}
        <footer className="welcome-footer">
          <button
            type="button"
            className="welcome-settings-pill"
            onClick={onOpenSettings}
          >
            <Settings size={13} aria-hidden="true" />
            <span>{tr("welcome.settings")}</span>
            <kbd className="welcome-kbd">{formatShortcut(getShortcutMap().settings)}</kbd>
          </button>
          <div className="welcome-security-badge">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>{tr("welcome.localSafe")}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
