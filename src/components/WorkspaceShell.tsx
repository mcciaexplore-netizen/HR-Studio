import { useRef, useState, type ReactNode, type ComponentType } from "react";
import {
  Menu,
  X,
  Search,
  ChevronRight,
  RefreshCw,
  Sun,
  Moon,
  LogOut,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { PersonAvatar } from "./PersonAvatar";
import { navigationLabel } from "../i18n";
import type { SessionUser, CompanySettings } from "../types";

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  staff: boolean;
};
const groups = [
  { label: "Workspace", ids: ["dashboard", "employees", "leaves", "payroll"] },
  {
    label: "People operations",
    ids: ["operations", "recruitment", "performance", "orgchart"],
  },
  {
    label: "Resources",
    ids: ["documents", "assets", "idcard", "emailhub", "settings"],
  },
];

export function WorkspaceShell({
  user,
  company,
  items,
  active,
  language,
  theme,
  busy,
  onNavigate,
  onLanguage,
  onTheme,
  onRefresh,
  onLogout,
  children,
}: {
  user: SessionUser;
  company: CompanySettings;
  items: NavItem[];
  active: string;
  language: string;
  theme: string;
  busy: boolean;
  onNavigate: (id: string) => void;
  onLanguage: (value: string) => void;
  onTheme: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const role =
    user.accessRole === "owner"
      ? "Administrator"
      : user.accessRole === "hr"
        ? "HR Manager"
        : "Employee";
  const matches = items.filter((item) =>
    `${item.label} ${navigationLabel(language, item.id, item.label)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const navigate = (id: string) => {
    onNavigate(id);
    drawer.current?.close();
    setSearch("");
  };
  const navigation = () => (
    <>
      <label className="nav-search">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Find a section"
          placeholder="Find a section…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <nav aria-label="Main navigation" className="workspace-nav">
        {groups.map((group) => {
          const entries = matches.filter((item) => group.ids.includes(item.id));
          return entries.length ? (
            <div className="nav-group" key={group.label}>
              <p className="nav-group-label">{group.label}</p>
              {entries.map((item) => (
                <button
                  key={item.id}
                  className="nav-item"
                  aria-current={active === item.id ? "page" : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={18} />
                  <span>{navigationLabel(language, item.id, item.label)}</span>
                  {active === item.id && <span className="nav-active-dot" />}
                </button>
              ))}
            </div>
          ) : null;
        })}
        {!matches.length && (
          <p className="nav-empty">No sections found. Try another name.</p>
        )}
      </nav>
    </>
  );
  const workspace = (
    <div className="workspace-identity">
      <span className="workspace-building">
        <Building2 size={18} />
      </span>
      <div>
        <strong title={company.name}>{company.name}</strong>
        <span>{user.demo ? "Sample workspace" : company.slug}</span>
      </div>
    </div>
  );
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar print:hidden">
        <div className="sidebar-brand">
          <BrandMark />
        </div>
        {navigation()}
        <div className="sidebar-footer">
          {workspace}
          <span className="workspace-location">India · {company.currency}</span>
        </div>
      </aside>
      <dialog
        ref={drawer}
        className="navigation-drawer"
        aria-label="Workspace navigation"
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close();
        }}
      >
        <div className="drawer-content">
          <div className="drawer-heading">
            <BrandMark />
            <button
              className="icon-button"
              aria-label="Close navigation"
              onClick={() => drawer.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
          {navigation()}
          <div className="sidebar-footer">
            <button className="secondary-button" onClick={onTheme}>
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              {theme === "dark" ? "Use light theme" : "Use dark theme"}
            </button>
            {workspace}
          </div>
        </div>
      </dialog>
      <div className="workspace-body">
        <header className="workspace-header print:hidden">
          <div className="workspace-breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => drawer.current?.showModal()}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <ChevronRight className="breadcrumb-divider" size={15} />
            <strong>
              {navigationLabel(
                language,
                active,
                items.find((item) => item.id === active)?.label || "Overview",
              )}
            </strong>
          </div>
          <div className="header-controls">
            <span role="status" className="save-status">
              {busy ? "Saving…" : ""}
            </span>
            <select
              aria-label="Navigation language"
              value={language}
              onChange={(event) => onLanguage(event.target.value)}
              className="language-control"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
            <button
              className="icon-button"
              aria-label="Refresh records"
              title="Refresh records"
              disabled={busy}
              onClick={onRefresh}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-button theme-control"
              aria-label={
                theme === "dark" ? "Use light theme" : "Use dark theme"
              }
              title="Change appearance"
              onClick={onTheme}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="header-person">
              <PersonAvatar name={user.name} />
              <span>
                <strong>{user.name}</strong>
                <small>{role}</small>
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              disabled={busy}
              onClick={onLogout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1} className="workspace-main">
          {user.demo && (
            <section
              className="demo-notice print:hidden"
              aria-label="Demo workspace"
            >
              <span className="demo-indicator" />
              <p>
                <strong>Demo workspace</strong>
                <span>Fictional data · {role} view</span>
              </p>
              <button onClick={onLogout} disabled={busy}>
                Switch demo role <ArrowUpRight size={15} />
              </button>
            </section>
          )}
          {children}
          <footer className="workspace-footer print:hidden">
            <span>MCCIA HR Studio</span>
            <span>People. Processes. Progress.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
