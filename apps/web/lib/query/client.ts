import { QueryClient } from '@tanstack/react-query';

const ONE_SECOND_MS = 1000;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 15 seconds
      staleTime: 15 * ONE_SECOND_MS,
      // Keep unused data in cache for 1 day
      gcTime: ONE_DAY_MS,
      // Retry failed requests twice
      retry: (failureCount, error) => {
        if (failureCount < 2) {
          return true;
        }
        return false;
      },
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
  },
});
