import { useState, useCallback, useMemo } from "react";
import { HumanProofSDK } from "./HumanProofSDK.js";

/**
 * Top-notch React Hook for human-proof integration.
 * Provides easy liveness state management and enrollment flows.
 */
export function useHumanProof(config: { rpId: string; apiBase?: string }) {
  const sdk = useMemo(() => new HumanProofSDK(config), [config.rpId, config.apiBase]);
  
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Enroll the current device.
   */
  const enroll = useCallback(async (userId: string, displayName?: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const result = await sdk.enroll({ userId, displayName });
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Enrollment failed");
      setError(err);
      throw err;
    } finally {
      setIsBusy(false);
    }
  }, [sdk]);

  /**
   * Perform a verified action.
   */
  const execute = useCallback(async <T>(
    action: string,
    verifyAndFetch: () => Promise<T>
  ) => {
    setIsBusy(true);
    setError(null);
    try {
      const result = await verifyAndFetch();
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Verification failed");
      setError(err);
      throw err;
    } finally {
      setIsBusy(false);
    }
  }, []);

  return {
    sdk,
    enroll,
    execute,
    isBusy,
    error,
  };
}
