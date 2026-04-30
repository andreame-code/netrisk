export type WarTableIconName =
  | "bell"
  | "cards"
  | "chevronDown"
  | "clock"
  | "crosshair"
  | "filter"
  | "globe"
  | "medal"
  | "objective"
  | "search"
  | "shield"
  | "soldier"
  | "stealth"
  | "users";

type WarTableIconProps = {
  className?: string;
  name: WarTableIconName;
};

export function WarTableIcon({ className = "", name }: WarTableIconProps) {
  const iconClassName = `war-table-icon${className ? ` ${className}` : ""}`;

  switch (name) {
    case "bell":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8.8a6 6 0 0 0-12 0c0 7-2.4 7.5-2.4 7.5h16.8S18 15.8 18 8.8Z" />
          <path d="M9.7 19a2.5 2.5 0 0 0 4.6 0" />
        </svg>
      );
    case "cards":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m8.2 4 8.8 2.4-3.6 13.2-8.8-2.4L8.2 4Z" />
          <path d="m13.5 4.5 4.8 1.3-3.6 13.1" />
          <path d="M10.4 9.3 13 13l3.6-2.7" />
        </svg>
      );
    case "chevronDown":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "clock":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case "crosshair":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
        </svg>
      );
    case "filter":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M7 12h10" />
          <path d="M10 17h4" />
        </svg>
      );
    case "globe":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16" />
          <path d="M12 4a11 11 0 0 1 0 16" />
          <path d="M12 4a11 11 0 0 0 0 16" />
        </svg>
      );
    case "medal":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3h8l-1.7 5.2H9.7L8 3Z" />
          <circle cx="12" cy="14" r="5" />
          <path d="m12 11.5.8 1.6 1.8.2-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.2.8-1.6Z" />
        </svg>
      );
    case "objective":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.4" />
        </svg>
      );
    case "search":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6" />
          <path d="m15.4 15.4 4.1 4.1" />
        </svg>
      );
    case "shield":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5 19 6v5.3c0 4.3-2.8 7.2-7 9.2-4.2-2-7-4.9-7-9.2V6l7-2.5Z" />
          <path d="m9.2 12.1 2 2 3.8-4.4" />
        </svg>
      );
    case "soldier":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8.5 6.5C9.8 5 14.2 5 15.5 6.5v2h-7v-2Z" />
          <path d="M7 10h10" />
          <path d="M9 10.5a3 3 0 0 0 6 0" />
          <path d="M12 14v6" />
          <path d="m8 20 4-6 4 6" />
        </svg>
      );
    case "stealth":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 12s3.2-5 8.5-5c1.5 0 2.8.4 4 .9" />
          <path d="M20.5 12s-3.2 5-8.5 5c-1.5 0-2.8-.4-4-.9" />
          <path d="M4 4 20 20" />
        </svg>
      );
    case "users":
      return (
        <svg className={iconClassName} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8.5" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 11.5a2.4 2.4 0 0 0 0-4.8" />
          <path d="M17 19a4.4 4.4 0 0 0-2.5-4" />
        </svg>
      );
  }
}

export function WarTableAvatar({ label }: { label: string }) {
  const initial = label.trim().charAt(0).toUpperCase() || "A";

  return (
    <span className="war-nav-avatar" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <defs>
          <linearGradient id="war-nav-avatar-bg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f1c07b" />
            <stop offset="0.44" stopColor="#8a4c2c" />
            <stop offset="1" stopColor="#111b20" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="24" fill="url(#war-nav-avatar-bg)" />
        <path d="M14 38c1.2-7.2 5-10.6 10-10.6S32.8 30.8 34 38" fill="#161d21" opacity="0.86" />
        <circle cx="24" cy="19" r="8.2" fill="#f0c18c" />
        <path
          d="M16.2 20.5c1.4-8.7 7-11 14.8-7.4 1.6 4.8-.5 8.1-3.1 10.2l-1.1-4.1-4.1 2.2-4.8-.8-.7 3.1c-.5-.8-.8-1.8-1-3.2Z"
          fill="#171514"
        />
        <path
          d="M18 27c4.4 3.6 8.6 3.6 12 0-.6 3.8-2.6 6.1-6 6.1S18.6 30.8 18 27Z"
          fill="#231714"
        />
        <text
          x="24"
          y="42"
          fill="#ffe9be"
          fontFamily="Arial, sans-serif"
          fontSize="8"
          fontWeight="700"
          textAnchor="middle"
        >
          {initial}
        </text>
      </svg>
    </span>
  );
}
