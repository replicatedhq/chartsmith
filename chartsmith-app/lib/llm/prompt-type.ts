import Anthropic from '@anthropic-ai/sdk';
import { logger } from "@/lib/utils/logger";

export enum PromptType {
  Plan = "plan",
  Chat = "chat",
}

export async function promptType(message: string): Promise<PromptType> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: `You are ChartSmith, an expert at creating Helm charts for Kuberentes.
You are invited to participate in an existing conversation between a user and an expert.
The expert just provided a recommendation on how to plan the Helm chart to the user.
The user is about to ask a question.
You should decide if the user is asking for a change to the plan/chart, or if they are just asking a conversational question.
Be exceptionally brief and precise. in your response.
Only say "plan" or "chat" in your response.
`,
      messages: [
        { role: "user", content: message }
    ]});
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';

    if (text.toLowerCase().includes("plan")) {
      return PromptType.Plan;
    } else {
      return PromptType.Chat;
    }
  } catch (err) {
    logger.error("Error determining prompt type", err);
    throw err;
  }
}
