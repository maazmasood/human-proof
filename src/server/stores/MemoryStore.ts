import { HumanChallenge, IHumanProofStore, StoredCredential } from "../../shared/types.js";

/**
 * Default in-memory implementation of IHumanProofStore.
 * Suitable for development and single-server prototypes.
 */
export class MemoryStore implements IHumanProofStore {
  private challenges = new Map<string, HumanChallenge>();
  private credentials = new Map<string, StoredCredential>();

  saveChallenge(challenge: HumanChallenge): void {
    this.challenges.set(challenge.challengeId, challenge);
  }

  getChallenge(challengeId: string): HumanChallenge | undefined {
    return this.challenges.get(challengeId);
  }

  deleteChallenge(challengeId: string): void {
    this.challenges.delete(challengeId);
  }

  saveCredential(credential: StoredCredential): void {
    this.credentials.set(credential.credentialId, credential);
  }

  getCredential(credentialId: string): StoredCredential | undefined {
    return this.credentials.get(credentialId);
  }

  listCredentials(): StoredCredential[] {
    return [...this.credentials.values()];
  }

  deleteCredential(credentialId: string): void {
    this.credentials.delete(credentialId);
  }
}
