"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SerwistProvider } from "@serwist/next/react";
import { CommandProvider } from './CommandProvider';
import { ThemeProvider } from '@/lib/theme-context';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <SessionProvider>
      <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === "development"} register>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <CommandProvider>
              {children}
            </CommandProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SerwistProvider>
    </SessionProvider>
  );
}

