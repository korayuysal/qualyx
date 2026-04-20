'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ScheduleRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    router.refresh();
    setBusy(false);
  }

  async function remove() {
    if (!confirm('Delete this schedule?')) return;
    setBusy(true);
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex justify-end gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50"
      >
        {enabled ? 'Disable' : 'Enable'}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
