import { useQuery } from "@tanstack/react-query";
import { fetchEthUsdPrice } from "@/lib/utils/ethPrice";

export function useEthUsdPrice(enabled: boolean = true) {
  return useQuery({
    queryKey: ["eth-usd-price"],
    queryFn: fetchEthUsdPrice,
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000
  });
}
