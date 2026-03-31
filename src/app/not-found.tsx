'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-tertiary mb-6">
        <span className="text-2xl font-bold text-text-tertiary">404</span>
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-text-primary lg:text-2xl">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-text-secondary max-w-[320px] leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-lg bg-accent-primary px-5 py-2 text-sm font-medium text-text-inverse transition hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2"
      >
        Go home
      </Link>
    </div>
  );
}
