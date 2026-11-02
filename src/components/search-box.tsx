"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export function SearchBox({ placeholder }: { placeholder: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(params.get("q") ?? "");
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => router.replace(q ? `${path}?q=${encodeURIComponent(q)}` : path, { scroll: false }), 200);
    return () => clearTimeout(t);
  }, [q, params, path, router]);
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-7 w-full rounded border border-line bg-surface pl-8 pr-2 text-sm placeholder:text-fg-3 hover:border-line-strong focus:border-focus focus:outline-none" />
    </div>
  );
}
