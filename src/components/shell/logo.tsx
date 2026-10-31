export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="rgb(var(--fg))" />
      <path d="M6 12.2 12 7l6 5.2" fill="none" stroke="rgb(var(--bg-app))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 13.2V17h7v-3.8" fill="none" stroke="rgb(var(--bg-app))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.6" cy="6.4" r="1.6" fill="rgb(var(--positive))" />
    </svg>
  );
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold tracking-tight text-fg">Home Buyers ICT</div>
          <div className="truncate text-2xs font-medium uppercase tracking-[0.08em] text-fg-3">Acquisition OS</div>
        </div>
      )}
    </div>
  );
}
