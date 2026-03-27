import type { IHumanProofStore, StoredCredential, HumanChallenge } from "../../shared/types.js";

/**
 * Professional Prisma/SQL Storage Adapter for Human-Proof.
 * Expects a Prisma client with `humanChallenge` and `humanCredential` models.
 */
export class PrismaStore implements IHumanProofStore {
  private prisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(prismaClient: any) {
    this.prisma = prismaClient;
  }

  async getChallenge(challengeId: string): Promise<HumanChallenge | undefined> {
    const record = await this.prisma.humanChallenge.findUnique({
      where: { challengeId },
    });
    if (!record) return undefined;
    return {
      challengeId: record.challengeId,
      challenge: record.challenge,
      action: record.action,
      expiresAt: Number(record.expiresAt),
    };
  }

  async saveChallenge(challenge: HumanChallenge): Promise<void> {
    await this.prisma.humanChallenge.upsert({
      where: { challengeId: challenge.challengeId },
      update: { ...challenge },
      create: { ...challenge },
    });
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    await this.prisma.humanChallenge
      .delete({
        where: { challengeId },
      })
      .catch(() => {}); // Ignore if already deleted
  }

  async getCredential(credentialId: string): Promise<StoredCredential | undefined> {
    const record = await this.prisma.humanCredential.findUnique({
      where: { credentialId },
    });
    if (!record) return undefined;
    return {
      ...record,
      publicKeyJwk: JSON.parse(record.publicKeyJwk),
      createdAt: Number(record.createdAt),
      lastVerifiedAt: Number(record.lastVerifiedAt),
    } as StoredCredential;
  }

  async saveCredential(credential: StoredCredential): Promise<void> {
    const data = {
      ...credential,
      publicKeyJwk: JSON.stringify(credential.publicKeyJwk),
    };
    await this.prisma.humanCredential.upsert({
      where: { credentialId: credential.credentialId },
      update: data,
      create: data,
    });
  }

  async listCredentials(): Promise<StoredCredential[]> {
    const records = await this.prisma.humanCredential.findMany();
    return records.map(
      (r: {
        credentialId: string;
        publicKeyJwk: string;
        alg: number;
        signCount: number;
        trustTier: number;
        attestationType: string;
        createdAt: Date;
        lastVerifiedAt: Date;
      }) => ({
        ...r,
        publicKeyJwk: JSON.parse(r.publicKeyJwk),
        createdAt: Number(r.createdAt),
        lastVerifiedAt: Number(r.lastVerifiedAt),
      })
    );
  }

  async deleteCredential(credentialId: string): Promise<void> {
    await this.prisma.humanCredential
      .delete({
        where: { credentialId },
      })
      .catch(() => {});
  }
}
