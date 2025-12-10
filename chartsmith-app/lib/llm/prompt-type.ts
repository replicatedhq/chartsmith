import { logger } from "@/lib/utils/logger";

export enum PromptType {
  Plan = "plan",
  Chat = "chat",
}

export enum PromptRole {
  Packager = "packager",
  User = "user",
}

export interface PromptIntent {
  intent: PromptType;
  role: PromptRole;
}

export async function promptType(message: string): Promise<PromptType> {
  try {
    const response = await fetch('/api/prompt-type', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to classify prompt type' }));
      throw new Error(error.error || 'Failed to classify prompt type');
    }

    const data = await response.json();
    return data.type === 'plan' ? PromptType.Plan : PromptType.Chat;
  } catch (err) {
    logger.error("Error determining prompt type", err);
    throw err;
  }
}
