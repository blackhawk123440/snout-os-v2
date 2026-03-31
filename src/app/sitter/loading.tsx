'use client';

export default function SitterLoading() {
  return (
    <div className="mx-auto max-w-3xl pb-8">
      <div className="space-y-4 animate-pulse">
        <div>
          <div className="h-7 w-40 rounded bg-surface-tertiary" />
          <div className="mt-2 h-4 w-52 rounded bg-surface-tertiary" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-primary shadow-sm p-4">
              <div className="h-3 w-14 rounded bg-surface-tertiary" />
              <div className="mt-2 h-8 w-10 rounded bg-surface-tertiary" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-surface-primary shadow-sm p-4">
          <div className="h-4 w-24 rounded bg-surface-tertiary mb-3" />
          <div className="h-16 rounded bg-surface-tertiary" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-primary shadow-sm p-4">
            <div className="h-4 w-32 rounded bg-surface-tertiary mb-3" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-3 py-2">
                <div className="h-4 w-14 rounded bg-surface-tertiary" />
                <div className="h-2.5 w-2.5 rounded-full bg-surface-tertiary" />
                <div className="flex-1 h-4 rounded bg-surface-tertiary" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
