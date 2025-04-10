"use server"

import { Session } from "@/lib/types/session"
import { createExtensionToken } from "./extension-token"

export async function authorizeExtensionAction(sess: Session) {
   const token = await createExtensionToken(sess.user.id)

   return {
    token,
   }
}
