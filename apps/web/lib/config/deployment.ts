import sample from "./sample-deployment.json";

export type DeploymentManifest = {
  network: string;
  factory: string;
  router: string;
  wmegaeth: string;
  feeToSetter?: string;
};

const fallback = sample as DeploymentManifest;

export const loadDeployment = async (
  networkOverride?: string,
): Promise<DeploymentManifest> => {
  const envNetwork =
    networkOverride ||
    process.env.NEXT_PUBLIC_MEGAETH_NETWORK ||
    "megaethTestnet";
  try {
    const manifestUrl = `/deployments/${envNetwork}.json`;
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`Manifest ${envNetwork}.json not found`);
    return (await response.json()) as DeploymentManifest;
  } catch (error) {
    console.warn("[deployments] falling back to sample manifest:", error);
    return fallback;
  }
};
