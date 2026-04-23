"use client";

import { Bell, Settings, Zap } from "lucide-react";

export function AppHeaderBar() {
  return (
    <header className="app-header-bar">
      <div className="app-header-brand">
        <div className="brand-icon">
          <Zap size={16} />
        </div>
        <div>
          <h1>Agent Evaluation Studio</h1>
          <p>Make your Agent Brilliant</p>
        </div>
      </div>
      <div className="app-header-actions">
        <button type="button" className="header-icon-btn" aria-label="Settings">
          <Settings size={18} />
        </button>
        <button type="button" className="header-icon-btn" aria-label="Notifications">
          <Bell size={18} />
          <span className="header-bell-dot" />
        </button>
        <div className="header-user-pill">
          <span className="header-user-avatar" aria-hidden>
            A
          </span>
          <span>Admin</span>
        </div>
      </div>
    </header>
  );
}
