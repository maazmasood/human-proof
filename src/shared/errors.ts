/**
 * Human-Proof Error System
 * Standardized errors for a top-notch developer experience.
 */

export type HumanProofErrorCode =
  | "HP_CHALLENGE_EXPIRED"
  | "HP_CHALLENGE_MISMATCH"
  | "HP_SIGNATURE_INVALID"
  | "HP_CREDENTIAL_NOT_FOUND"
  | "HP_SECURITY_CONTEXT_REQUIRED"
  | "HP_ALGORITHM_UNSUPPORTED"
  | "HP_STORE_ERROR"
  | "HP_INTERNAL_ERROR";

export class HumanProofError extends Error {
  public readonly code: HumanProofErrorCode;
  public readonly statusCode: number;

  constructor(code: HumanProofErrorCode, message: string, statusCode: number = 400) {
    super(message);
    this.name = "HumanProofError";
    this.code = code;
    this.statusCode = statusCode;

    // Ensure proper stack trace
    Object.setPrototypeOf(this, HumanProofError.prototype);
  }

  public toJSON() {
    return {
      success: false,
      error: this.code,
      message: this.message,
    };
  }
}

/** Error Factories */
export const Errors = {
  ChallengeExpired: () =>
    new HumanProofError(
      "HP_CHALLENGE_EXPIRED",
      "The challenge has expired. Please request a new one.",
      401
    ),
  ChallengeMismatch: () =>
    new HumanProofError(
      "HP_CHALLENGE_MISMATCH",
      "Signature belongs to a different challenge.",
      400
    ),
  SignatureInvalid: () =>
    new HumanProofError(
      "HP_SIGNATURE_INVALID",
      "Cryptographic signature verification failed.",
      401
    ),
  CredentialNotFound: () =>
    new HumanProofError(
      "HP_CREDENTIAL_NOT_FOUND",
      "No human-key found for this device on the server.",
      404
    ),
  SecurityContextRequired: () =>
    new HumanProofError(
      "HP_SECURITY_CONTEXT_REQUIRED",
      "Human-Proof requires a secure context (HTTPS or localhost).",
      400
    ),
  AlgorithmUnsupported: () =>
    new HumanProofError(
      "HP_ALGORITHM_UNSUPPORTED",
      "The device authenticator algorithm is not supported.",
      400
    ),
  StoreError: (msg: string) =>
    new HumanProofError("HP_STORE_ERROR", `Storage operation failed: ${msg}`, 500),
  Internal: (msg: string) =>
    new HumanProofError("HP_INTERNAL_ERROR", `Internal Protocol Error: ${msg}`, 500),
};
