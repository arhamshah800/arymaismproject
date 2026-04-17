import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google('gemini-1.5-flash'),
    messages,
    // This is the "Brain's Instructions":
    system: `You are the Aryma ISM AI, a specialized assistant for the Aryma Industrial Supply Management platform. 
    Your goal is to help users manage inventory, track orders, and optimize logistics. 
    Be professional, concise, and helpful. If a user asks who you are, identify as the Aryma ISM Assistant.`,
  });

  return result.toUIMessageStreamResponse();
}
