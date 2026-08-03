export function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-label="Income Tiles logo"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <rect x="6" y="21" width="4" height="5" fill="currentColor" opacity="0.45" />
      <rect x="12" y="16" width="4" height="10" fill="currentColor" opacity="0.65" />
      <rect x="18" y="11" width="4" height="15" fill="currentColor" opacity="0.85" />
      <rect x="24" y="6" width="2" height="20" fill="currentColor" />
      <path d="M4 18.5H28" stroke="currentColor" strokeWidth="1.25" strokeDasharray="2 2.5" opacity="0.9" />
    </svg>
  );
}

export function LogoWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-primary">
        <Logo className={compact ? 'h-6 w-6' : 'h-7 w-7'} />
      </span>
      <div className="leading-none">
        <div className="text-sm font-semibold tracking-tight">Income Tiles</div>
        {!compact && (
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Distribution explorer</div>
        )}
      </div>
    </div>
  );
}
