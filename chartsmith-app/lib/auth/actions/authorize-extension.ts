"use server"

import { Session } from "@/lib/types/session"
import { createExtensionToken } from "@/lib/auth/extension-token"
export async function authorizeExtensionAction(sess: Session) {
   const token = await createExtensionToken(sess.user.id)

   return {
    token,
   }
}
