import { HumanProofInstance } from "../../../../lib/humanProof.js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { action } = await request.json();

  if (!action) {
    return NextResponse.json({ error: "Action required" }, { status: 400 });
  }

  const challenge = await HumanProofInstance.createChallenge(action);
  return NextResponse.json(challenge);
}
