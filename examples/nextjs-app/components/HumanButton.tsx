"use client";

import { useHumanProof } from "human-proof";
import { useState } from "react";

/**
 * Premium Human-Verified button for Next.js.
 */
export function HumanButton({ 
  action, 
  onVerified, 
  children 
}: { 
  action: string, 
  onVerified: (proof: any) => void,
  children: React.ReactNode 
}) {
  const { sdk, isBusy, error } = useHumanProof({ 
    rpId: window.location.hostname 
  });

  const handleClick = async () => {
    try {
      const proof = await sdk.prove(action);
      onVerified(proof);
    } catch (e) {
      console.error("Human verification failed", e);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isBusy}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition"
      >
        {isBusy ? "Verifying..." : children}
      </button>
      {error && <p className="text-sm text-red-500">{error.message}</p>}
    </div>
  );
}
