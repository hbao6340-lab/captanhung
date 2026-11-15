"use client";

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // ignore fetch errors; still redirect
        }
        window.location.href = "/admin-login";
      }}
      className="text-sm text-gray-600 hover:text-red-600 underline"
    >
      Sign out
    </button>
  );
}
