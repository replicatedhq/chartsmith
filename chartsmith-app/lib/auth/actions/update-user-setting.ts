"use server"

import { Session } from "@/lib/types/session";
import { updateUserSetting } from "../user";
import { UserSetting } from "@/lib/types/user";
import { logger } from "@/lib/utils/logger";

export async function updateUserSettingAction(session: Session, key: string, value: string): Promise<UserSetting> {
  logger.info("Updating user setting", { "user.id": session.user.id, key, value });
  const updatedSettings = await updateUserSetting(session.user.id, key, value);
  return updatedSettings;
}
