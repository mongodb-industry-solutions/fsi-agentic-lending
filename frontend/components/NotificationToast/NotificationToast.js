"use client";

import { useState, useEffect, useCallback } from "react";

const TOAST_DURATION = 4500;

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

const TYPE_COLORS = {
  info: {
    bg: "var(--agent-cyan-dim)",
    border: "var(--agent-cyan)",
    color: "var(--agent-cyan)",
  },
  success: {
    bg: "var(--success-dim)",
    border: "var(--success)",
    color: "var(--success)",
  },
  warning: {
    bg: "var(--hitl-amber-dim)",
    border: "var(--hitl-amber)",
    color: "var(--hitl-amber)",
  },
  error: {
    bg: "var(--danger-dim)",
    border: "var(--danger)",
    color: "var(--danger)",
  },
};

function Toast({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const colors = TYPE_COLORS[toast.type] || TYPE_COLORS.info;
  const toastRole = (toast.type === 'error' || toast.type === 'warning') ? 'alert' : 'status';

  return (
    <div
      role={toastRole}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dismiss();
        }
      }}
      style={{
        padding: "10px 14px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--radius-md)",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        minWidth: 280,
        maxWidth: 360,
        animation: exiting
          ? "toastExit 0.3s ease-in forwards"
          : "toastEnter 0.3s ease-out",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
      onClick={dismiss}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>
        {toast.icon || "🔔"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 11,
              color: colors.color,
              marginBottom: 2,
            }}
          >
            {toast.title}
          </div>
        )}
        <div
          style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4 }}
        >
          {toast.message}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-dim)",
          fontSize: 14,
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function NotificationToast({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      role="log"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
      }}
    >
      {toasts.slice(-5).map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
