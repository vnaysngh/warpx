"use client";

import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from '@/lib/query/client';
import { type PropsWithChildren } from 'react';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Create persister for localStorage
const persister = typeof window !== 'undefined'
  ? createSyncStoragePersister({
      storage: window.localStorage,
      key: 'WARPX_QUERY_CACHE',
    })
  : undefined;

export function QueryProvider({ children }: PropsWithChildren) {
  // Use persistence if available (client-side), otherwise just QueryClientProvider
  if (persister) {
    const persistOptions = {
      persister,
      maxAge: ONE_DAY_MS,
      buster: 'v1', // Increment this to invalidate all cached data
      dehydrateOptions: {
        // Don't persist queries that might contain sensitive data
        shouldDehydrateQuery: (query: any) => {
          if (query.state?.status === 'pending' || query.state?.fetchStatus !== 'idle') {
            return false;
          }
          // Don't persist user-specific queries
          const queryKey = query.queryKey;
          if (Array.isArray(queryKey) && queryKey.includes('user-lp-balance')) {
            return false;
          }
          return true;
        },
      },
    };

    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        {children}
      </PersistQueryClientProvider>
    );
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
