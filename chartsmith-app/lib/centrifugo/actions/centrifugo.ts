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
    const claims: CentrifugoClaims = {
      sub: workspaceID,
      exp: new Date().getTime() + 60 * 60,
      iat: new Date().getTime(),
    };

    const jwtSigningKey = await getCentrifugoJwtSigningKey();
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
