interface KeyBadgeProps {
  keys: string[];
}

export function KeyBadge({ keys }: KeyBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "10px",
                color: "var(--text-muted)",
                margin: "0 1px",
              }}
            >
              +
            </span>
          )}
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-secondary)",
              background: "var(--glass-surface-strong)",
              border: "1px solid var(--glass-edge)",
              boxShadow: "var(--glass-highlight), 0 1px 1px rgba(0,0,0,0.25)",
              borderRadius: "6px",
              padding: "2px 7px",
              display: "inline-block",
            }}
          >
            {key}
          </span>
        </span>
      ))}
    </span>
  );
}
