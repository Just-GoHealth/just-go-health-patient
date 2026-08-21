type IconProps = {
  className?: string;
};

const strokeProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PledgeIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2" />
      <path d="M16.4 11a2.9 2.9 0 1 0-1.5-5.3" />
      <path d="M17 14.7c2.3.4 3.9 2.2 3.9 4.9" />
    </svg>
  );
}

export function ProvidersIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 1.8a4.7 4.7 0 0 0-4.7 4.7V9H6.4A2.4 2.4 0 0 0 4 11.4v8.2A2.4 2.4 0 0 0 6.4 22h11.2a2.4 2.4 0 0 0 2.4-2.4v-8.2A2.4 2.4 0 0 0 17.6 9h-.9V6.5A4.7 4.7 0 0 0 12 1.8zm0 2.1a2.6 2.6 0 0 1 2.6 2.6V9H9.4V6.5A2.6 2.6 0 0 1 12 3.9zm0 9.1a1.9 1.9 0 0 1 1 3.5v2a1 1 0 1 1-2 0v-2a1.9 1.9 0 0 1 1-3.5z" />
    </svg>
  );
}

export function HandIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-1.5-2.6a1.5 1.5 0 0 1 2.6-1.5L8 14.5" />
    </svg>
  );
}

export function ReceiptIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M5 2.6v18.8l2.4-1.5 2.1 1.5 2.1-1.5 2.1 1.5 2.1-1.5 2.2 1.5V2.6z" />
      <path d="M8.4 7.6h7.2" />
      <path d="M8.4 11.4h7.2" />
      <path d="M8.4 15.2h4.6" />
    </svg>
  );
}

export function StudiosIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <rect x="2.5" y="8.5" width="15" height="11" rx="2.5" />
      <circle cx="7" cy="14" r="2.4" />
      <line x1="13" y1="12" x2="13" y2="16" />
      <path d="M14.5 4.5L18 3.2" />
      <path d="M17 12a4 4 0 0 1 0 4" />
      <path d="M19.4 10.4a7 7 0 0 1 0 7.2" />
    </svg>
  );
}

export function NoIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M16 18l-4-4-4 4" />
      <path d="M3 15h4l1.5-9 3 15 2.5-7 1 4h6" />
    </svg>
  );
}

export function YesIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

export function DatingIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M12 20.3s-6.9-4.2-9.1-8.2C1.3 9.1 3 5.6 6.2 5.6c1.9 0 3.2 1.1 3.8 2.2.6-1.1 1.9-2.2 3.8-2.2 3.2 0 4.9 3.5 3.3 6.5-2.2 4-9.1 8.2-9.1 8.2z" />
    </svg>
  );
}

export function ExamIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <path d="M2.5 8.4 12 4l9.5 4.4L12 12.8z" />
      <path d="M6.5 10.6V16c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-5.4" />
      <path d="M21.5 8.4v5" />
    </svg>
  );
}

export function InternshipIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps} className={className}>
      <rect x="3" y="7.5" width="18" height="12" rx="2.2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  );
}
