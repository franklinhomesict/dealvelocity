import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell/shell";
import { getAttention, hasSampleData } from "@/lib/queries";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const jar = await cookies();
  const [attention, sample, [counts]] = await Promise.all([
    getAttention(),
    hasSampleData(),
    db.execute(sql`select count(*)::int as n from leads where stage not in ('closed','dead')`) as unknown as Promise<{ n: number }[]>,
  ]);
  return (
    <Shell
      user={user}
      counts={{ activeLeads: counts.n, attention: attention.filter((a) => a.severity === "negative" || a.severity === "warning").length }}
      attention={attention}
      initialCollapsed={jar.get("aos_sidebar")?.value === "collapsed"}
      initialTheme={jar.get("aos_theme")?.value === "light" ? "light" : "dark"}
      hasSample={sample}
    >
      {children}
    </Shell>
  );
}
