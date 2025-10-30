import { useEffect, useState } from "react";
import type { DeploymentManifest } from "@/lib/config/deployment";
import { loadDeployment } from "@/lib/config/deployment";

export function useDeploymentManifest() {
  const [deployment, setDeployment] = useState<DeploymentManifest | null>(null);
  const [loadingDeployment, setLoadingDeployment] = useState(false);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        setLoadingDeployment(true);
        const manifest = await loadDeployment();
        if (mounted) setDeployment(manifest);
      } catch (err) {
        console.warn("[manifest] failed to load deployment", err);
      } finally {
        if (mounted) setLoadingDeployment(false);
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  return { deployment, loadingDeployment };
}
