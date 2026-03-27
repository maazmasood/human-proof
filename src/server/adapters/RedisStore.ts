import type { IHumanProofStore, StoredCredential, HumanChallenge } from "../../shared/types.js";

/**
 * Professional Redis Storage Adapter for Human-Proof.
 * Requires `ioredis` or a compatible client.
 */
export class RedisStore implements IHumanProofStore {
  private client: any;
  private prefix: string;

  constructor(redisClient: any, options: { prefix?: string } = {}) {
    this.client = redisClient;
    this.prefix = options.prefix || "human-proof";
  }

  async getChallenge(challengeId: string): Promise<HumanChallenge | undefined> {
    const data = await this.client.get(`${this.prefix}:challenge:${challengeId}`);
    return data ? JSON.parse(data) : undefined;
  }

  async saveChallenge(challenge: HumanChallenge): Promise<void> {
    const ttl = Math.ceil((challenge.expiresAt - Date.now()) / 1000);
    if (ttl <= 0) return;

    await this.client.set(
      `${this.prefix}:challenge:${challenge.challengeId}`,
      JSON.stringify(challenge),
      "EX",
      ttl
    );
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    await this.client.del(`${this.prefix}:challenge:${challengeId}`);
  }

  async getCredential(credentialId: string): Promise<StoredCredential | undefined> {
    const data = await this.client.get(`${this.prefix}:credential:${credentialId}`);
    return data ? JSON.parse(data) : undefined;
  }

  async saveCredential(credential: StoredCredential): Promise<void> {
    // Credentials typically don't expire, or have very long TTLs.
    await this.client.set(
      `${this.prefix}:credential:${credential.credentialId}`,
      JSON.stringify(credential)
    );
  }

  async listCredentials(): Promise<StoredCredential[]> {
    const keys = await this.client.keys(`${this.prefix}:credential:*`);
    if (!keys.length) return [];
    const values = await this.client.mget(keys);
    return values.map((v: string) => JSON.parse(v));
  }

  async deleteCredential(credentialId: string): Promise<void> {
    await this.client.del(`${this.prefix}:credential:${credentialId}`);
  }
}
