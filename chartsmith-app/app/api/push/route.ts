import { userIdFromExtensionToken } from "@/lib/auth/extension-token";
import { getCentrifugoToken } from "@/lib/centrifugo/centrifugo";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  console.log("GET /api/push");
  try {
    // if there's an auth header, use that to find the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = await userIdFromExtensionToken(authHeader.split(' ')[1])

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pushToken = await getCentrifugoToken(userId)

    return NextResponse.json({ pushToken }, { status: 200 });
  } catch (error) {
    console.error("Failed to get push:", error);
    return NextResponse.json({ error: "Failed to get push" }, { status: 500 });
  }
}

