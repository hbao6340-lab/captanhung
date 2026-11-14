import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

const NAV: { label: string; href: string }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Events", href: "/dashboard/events" },
  { label: "Attendance", href: "/dashboard/attendance" },
  { label: "Evidence review", href: "/dashboard/evidence" },
  { label: "Reports", href: "/dashboard/reports" },
  { label: "Administrators", href: "/dashboard/users" },
  { label: "Audit logs", href: "/dashboard/audit-logs" },
  { label: "Settings", href: "/dashboard/settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/dashboard" className="font-bold text-xl text-indigo-700">CAPTANHUNG Admin</Link>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden md:flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-100 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{user.full_name}</div>
                  <div className="text-xs text-gray-500">{user.role}</div>
                </div>
                <button
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/admin-login";
                  }}
                  className="text-sm text-gray-600 hover:text-red-600 underline"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <a href="/admin-login" className="text-sm text-gray-600 hover:text-indigo-600">Sign in</a>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 border-r border-gray-200 bg-white flex-col md:flex">
          <nav className="py-4 px-3 space-y-1">
            {NAV.map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-indigo-600">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
