import * as jwt from "jsonwebtoken";

interface CentrifugoClaims {
  sub: string;
  exp: number;
  iat: number;
  channels?: string[];
}

export async function getCentrifugoToken(workspaceID: string): Promise<string> {
  console.log("getting centrifugo token for workspace", workspaceID);
  try {
    const nowInSeconds = Math.floor(Date.now() / 1000); // Convert milliseconds to seconds
    const claims: CentrifugoClaims = {
      sub: workspaceID,
      exp: nowInSeconds + 60 * 60, // 1 hour from now
      iat: nowInSeconds, // Issued at current time in seconds
    };

    const jwtSigningKey = await getCentrifugoJwtSigningKey();

    // print the 1st 4 and last 4 of the jwtSigningKey to debug
    const key = jwtSigningKey.toString();
    const key1 = key.slice(0, 4);
    const key2 = key.slice(-4);
    console.log(`jwtSigningKey: ${key1}...${key2}`);

    const token = jwt.sign(claims, jwtSigningKey);
    return token;
  } catch (err) {
    console.error(err);
    return "";
  }
}

async function getCentrifugoJwtSigningKey(): Promise<jwt.Secret> {
  if (process.env["CENTRIFUGO_TOKEN_HMAC_SECRET"]) {
    return process.env["CENTRIFUGO_TOKEN_HMAC_SECRET"];
  }

  throw new Error("no jwt signing key found, set CENTRIFUGO_TOKEN_HMAC_SECRET");
}
