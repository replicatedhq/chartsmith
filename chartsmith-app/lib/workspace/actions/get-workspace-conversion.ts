"use server"

import { Session } from "@/lib/types/session";
import { Conversion } from "@/lib/types/workspace";
import { getConversion } from "../workspace";

export async function getWorkspaceConversionAction(session: Session, conversionId: string): Promise<Conversion> {
  const conversion = await getConversion(conversionId);
  if (!conversion) {
    throw new Error("Conversion not found");
  }
  return conversion;
}
