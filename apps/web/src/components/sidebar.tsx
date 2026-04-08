'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const nav = [
  { name: 'Dashboard', href: '/', icon: '◉' },
  { name: 'Scenarios', href: '/scenarios', icon: '◧' },
  { name: 'Runs', href: '/runs', icon: '▶' },
  { name: 'Schedules', href: '/schedules', icon: '◷' },
  { name: 'Monitoring', href: '/monitoring', icon: '◈' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-gray-800 bg-gray-950">
      <div className="flex h-14 items-center gap-2 border-b border-gray-800 px-4">
        <span className="text-lg font-bold">Qualyx</span>
        <span className="rounded bg-blue-900/50 px-1.5 py-0.5 text-xs text-blue-300">
          QA
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {nav.map((item) => {
          const active = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-900 hover:text-gray-200"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
