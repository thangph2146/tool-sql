'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import {
  API_STALE_TIME,
  API_RETRY_COUNT,
  QUERY_CACHE_TIME,
} from '@/lib/constants';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: API_STALE_TIME,
            gcTime: QUERY_CACHE_TIME.MEDIUM, // Previously cacheTime
            refetchOnWindowFocus: false,
            retry: API_RETRY_COUNT,
            refetchOnMount: true,
            // Optimistic updates
            refetchOnReconnect: true,
          },
          mutations: {
            retry: API_RETRY_COUNT,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
        />
      )}
    </QueryClientProvider>
  );
}

