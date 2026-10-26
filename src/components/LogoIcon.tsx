interface LogoIconProps {
  size?: number;
}

// The "Onda" mark on its dark tile — the flat small-size variant of public/mini-logo.svg
// (same drawing as public/icon-small.svg). The tile keeps it readable on both themes.
export function LogoIcon({ size = 24 }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: "block" }}
      aria-label="Mushu"
    >
      <rect
        x="40"
        y="40"
        width="944"
        height="944"
        rx="220"
        fill="#17171A"
        stroke="#FFFFFF"
        strokeOpacity="0.24"
        strokeWidth="28"
      />
      <g transform="translate(167 167) scale(6.9)" fill="#F4F4F5">
        <rect x="13" y="20" width="10" height="60" rx="5" />
        <rect x="29" y="32" width="10" height="36" rx="5" />
        <rect x="45" y="24" width="10" height="52" rx="5" />
        <rect x="61" y="32" width="10" height="36" rx="5" />
        <rect x="77" y="20" width="10" height="60" rx="5" />
      </g>
    </svg>
  );
}
