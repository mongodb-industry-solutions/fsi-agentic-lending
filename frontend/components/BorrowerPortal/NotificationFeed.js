"use client";

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getNotificationStyle(notification, isNewest) {
  const sub = notification.subType;
  if (sub === 'intervention-issue') {
    return {
      bg: isNewest ? 'var(--hitl-amber-dim)' : 'var(--bg-surface)',
      border: isNewest ? 'var(--hitl-amber)' : 'var(--border-dim)',
      accent: 'var(--hitl-amber)',
      leftBorder: '3px solid var(--hitl-amber)',
    };
  }
  if (sub === 'intervention-resolved') {
    return {
      bg: isNewest ? 'var(--success-dim)' : 'var(--bg-surface)',
      border: isNewest ? 'var(--success)' : 'var(--border-dim)',
      accent: 'var(--success)',
      leftBorder: '3px solid var(--success)',
    };
  }
  if (sub === 'action-progress') {
    return {
      bg: isNewest ? 'var(--hitl-amber-dim)' : 'var(--bg-surface)',
      border: isNewest ? 'var(--hitl-amber)' : 'var(--border-dim)',
      accent: 'var(--hitl-amber)',
      leftBorder: '3px solid var(--hitl-amber)',
    };
  }
  if (sub === 'action-resolved') {
    return {
      bg: isNewest ? 'var(--success-dim)' : 'var(--bg-surface)',
      border: isNewest ? 'var(--success)' : 'var(--border-dim)',
      accent: 'var(--success)',
      leftBorder: '3px solid var(--success)',
    };
  }
  // Check if it's an action-required stage
  if (notification.stage?.type === 'action-required') {
    return {
      bg: isNewest ? 'var(--hitl-amber-dim)' : 'var(--bg-surface)',
      border: isNewest ? 'var(--hitl-amber)' : 'var(--border-dim)',
      accent: 'var(--hitl-amber)',
      leftBorder: '3px solid var(--hitl-amber)',
    };
  }
  // Check if it's an intervention stage
  if (notification.stage?.type === 'intervention') {
    return {
      bg: isNewest ? 'var(--hitl-amber-dim)' : 'var(--bg-surface)',
      border: isNewest ? 'var(--hitl-amber)' : 'var(--border-dim)',
      accent: isNewest ? 'var(--hitl-amber)' : 'var(--text-primary)',
      leftBorder: '3px solid var(--hitl-amber)',
    };
  }
  return {
    bg: isNewest ? 'var(--mongo-dim)' : 'var(--bg-surface)',
    border: isNewest ? 'var(--mongo)' : 'var(--border-dim)',
    accent: isNewest ? 'var(--mongo)' : 'var(--text-primary)',
    leftBorder: 'none',
  };
}

export default function NotificationFeed({ notifications }) {
  if (!notifications || notifications.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
        Waiting for updates...
      </div>
    );
  }

  const interventionCount = notifications.filter((n) => n.subType === 'intervention-resolved' || n.subType === 'action-resolved').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', borderLeft: '1px solid var(--border-dim)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>
          Live Updates
        </div>
        {interventionCount > 0 && (
          <span style={{
            padding: '2px 8px', borderRadius: 10,
            background: 'var(--success-dim)', color: 'var(--success)',
            fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>
            {interventionCount} resolved
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Real-time notifications as your application progresses.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[...notifications].reverse().map((n, i) => {
          const isNewest = i === 0;
          const style = getNotificationStyle(n, isNewest);
          const isSubEvent = !!n.subType;

          return (
            <div
              key={i}
              style={{
                padding: isSubEvent ? '7px 10px' : '10px 12px',
                background: style.bg,
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${style.border}`,
                borderLeft: style.leftBorder,
                animation: isNewest ? 'slideDown 0.3s ease-out' : undefined,
                marginLeft: isSubEvent ? 12 : 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: isSubEvent ? 10 : 11, color: style.accent }}>
                  {n.stage.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
                  {formatTime(n.time)}
                </span>
              </div>
              <div style={{ fontSize: isSubEvent ? 9 : 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {n.stage.detail}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection indicator */}
      <div style={{
        marginTop: 16, padding: '8px 12px',
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-dim)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, color: 'var(--text-dim)',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--success)',
          boxShadow: '0 0 6px var(--success)',
          animation: 'pulse 1.5s infinite',
        }} />
        Connected via MongoDB Change Streams
      </div>
    </div>
  );
}
