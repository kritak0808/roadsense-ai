"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { clsx } from "clsx";

const NAV_LINKS = [
  { href: "/", label: "Predict", icon: "🔍" },
  { href: "/history", label: "History", icon: "📊" },
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/reports", label: "Reports", icon: "📄" },
  { href: "/admin", label: "Admin", icon: "⚙️", adminOnly: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          {/* RoadSense AI logo — inline SVG, no external deps */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer circle */}
            <circle cx="14" cy="14" r="13" fill="#1e40af" stroke="#3b82f6" strokeWidth="1.5"/>
            {/* Road perspective lines */}
            <path d="M14 22 L8 8" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M14 22 L20 8" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
            {/* Road surface */}
            <path d="M9.5 16 L18.5 16" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round"/>
            <path d="M11 12 L17 12" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round"/>
            {/* Centre dashes */}
            <line x1="14" y1="20" x2="14" y2="18" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="14" y1="16" x2="14" y2="14" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="14" y1="12" x2="14" y2="10" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round"/>
            {/* AI pulse dot */}
            <circle cx="14" cy="7" r="2" fill="#3b82f6"/>
            <circle cx="14" cy="7" r="3.5" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.4"/>
          </svg>
          <span className="hidden sm:block tracking-tight">RoadSense AI</span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_LINKS.filter((l) => !l.adminOnly || user?.role === "admin").map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <span className="mr-1">{link.icon}</span>
              <span className="hidden md:inline">{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-xs text-gray-400 hidden sm:block">
                {user.username} · {user.role}
              </span>
              <button onClick={logout} className="btn-secondary text-sm py-1">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-sm py-1">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
