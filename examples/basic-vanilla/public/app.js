/**
 * Human-Proof Demo Application Logic
 */

// Simple base64url helpers for the demo
const b64url = {
  encode: (buf) => {
    const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer);
    let s = ""; for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  },
  decode: (s) => {
    const p = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
    const b = atob(p); const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer;
  }
};

const dom = {
  userId: document.getElementById("userId"),
  enrollBtn: document.getElementById("enrollBtn"),
  enrollStatus: document.getElementById("enrollStatus"),
  voteBtn: document.getElementById("voteBtn"),
  postBtn: document.getElementById("postBtn"),
  output: document.getElementById("logOutput"),
  clearLogs: document.getElementById("clearLogs")
};

const log = (msg, type = "info") => {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const entry = typeof msg === "object" ? JSON.stringify(msg, null, 2) : msg;
  dom.output.textContent += `\n[${time}] ${entry}`;
  dom.output.scrollTop = dom.output.scrollHeight;
};

// State
let isEnrolled = false;
const savedCid = localStorage.getItem("hp:cid");
if (savedCid) {
  isEnrolled = true;
  dom.enrollStatus.innerHTML = '<span class="success">✓ Enrolled with hardware key</span>';
  dom.voteBtn.disabled = false;
  dom.postBtn.disabled = false;
}

// ─── Enrollment ─────────────────────────────

async function parseSpki(spki) {
  try {
    const key = await crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    return { jwk: await crypto.subtle.exportKey("jwk", key), alg: -7 };
  } catch {
    try {
      const key = await crypto.subtle.importKey("spki", spki, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["verify"]);
      return { jwk: await crypto.subtle.exportKey("jwk", key), alg: -257 };
    } catch (e) { throw new Error("Unsupported algorithm"); }
  }
}

window.enroll = async function() {
  const userId = dom.userId.value;
  dom.enrollBtn.disabled = true;
  log(`Starting enrollment for ${userId}...`);

  try {
    // 1. Get options from server
    const opts = await fetch(`/human-proof/enroll/options?userId=${encodeURIComponent(userId)}`).then(r => r.json());
    
    // 2. Create hardware credential
    const cred = await navigator.credentials.create({
      publicKey: {
        ...opts,
        challenge: b64url.decode(opts.challenge),
        user: { ...opts.user, id: b64url.decode(opts.user.id) }
      }
    });

    const resp = cred.response;
    const { jwk, alg } = await parseSpki(resp.getPublicKey());
    // Heuristic attestation type detection for the demo
    const attObj = new TextDecoder().decode(new Uint8Array(resp.attestationObject));
    const attType = ["apple", "android-key", "tpm", "packed", "none"].find(f => attObj.includes(f)) || "self";

    // 3. Complete on server
    const result = await fetch("/human-proof/enroll/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": location.origin },
      body: JSON.stringify({
        userId,
        credentialId: b64url.encode(cred.rawId),
        publicKeyJwk: jwk,
        alg,
        attestationType: attType,
        clientDataJSON: b64url.encode(resp.clientDataJSON),
        authenticatorData: b64url.encode(resp.getAuthenticatorData()),
        challenge: opts.challenge
      })
    }).then(r => r.json());

    if (result.success) {
      localStorage.setItem("hp:cid", b64url.encode(cred.rawId));
      isEnrolled = true;
      dom.enrollStatus.innerHTML = '<span class="success">✓ Device successfully registered</span>';
      dom.voteBtn.disabled = false;
      dom.postBtn.disabled = false;
      log("Enrollment successful!");
      log(result);
    } else {
      throw new Error(result.error);
    }
  } catch (e) {
    log(`Enrollment failed: ${e.message}`, "error");
    dom.enrollStatus.innerHTML = `<span class="error">✗ ${e.message}</span>`;
  } finally {
    dom.enrollBtn.disabled = false;
  }
}

// ─── Protected Actions ──────────────────────

async function prove(action) {
  const cid = localStorage.getItem("hp:cid");
  if (!cid) throw new Error("Not enrolled");

  log(`Requesting human presence proof for action: ${action}...`);
  
  // 1. Get challenge
  const ch = await fetch("/human-proof/challenge", {
    method: "POST", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  }).then(r => r.json());

  // 2. Sign with hardware
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: b64url.decode(ch.challenge),
      rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: b64url.decode(cid) }],
      userVerification: "required"
    }
  });

  return {
    humanProof: {
      challengeId: ch.challengeId,
      credentialId: cid,
      authenticatorData: b64url.encode(assertion.response.authenticatorData),
      clientDataJSON: b64url.encode(assertion.response.clientDataJSON),
      signature: b64url.encode(assertion.response.signature)
    }
  };
}

async function handleVote() {
  try {
    const proof = await prove("vote:submit");
    log("Human proof generated. Submitting vote...");
    
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": location.origin },
      body: JSON.stringify({ optionId: 42, ...proof })
    }).then(r => r.json());
    
    log(res);
  } catch (e) {
    log(`Vote failed: ${e.message}`, "error");
  }
}

async function handlePost() {
  try {
    const proof = await prove("post:create");
    log("Human proof generated. Publishing post...");
    
    const res = await fetch("/api/post", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": location.origin },
      body: JSON.stringify({ content: "Physically verified human post.", ...proof })
    }).then(r => r.json());
    
    log(res);
  } catch (e) {
    log(`Post failed: ${e.message}`, "error");
  }
}

// ─── Listeners ─────────────────────────────

dom.enrollBtn.addEventListener("click", enroll);
dom.voteBtn.addEventListener("click", handleVote);
dom.postBtn.addEventListener("click", handlePost);
dom.clearLogs.addEventListener("click", () => dom.output.textContent = "// Logs cleared.");

log("Human-Proof SDK Demo Initialized.");
if (!window.PublicKeyCredential) {
  log("CRITICAL: WebAuthn is NOT supported in this browser.", "error");
  dom.enrollBtn.disabled = true;
}
