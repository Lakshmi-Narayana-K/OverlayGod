import { GoogleGenerativeAI, ChatSession, GenerativeModel, FunctionCallingMode } from '@google/generative-ai'

import { CLUELY_SYSTEM_PROMPT } from './systemPrompt'

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY is not set. Ensure it exists in .env or as a system env variable, or that it is defined in Vite env files.'
  )
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

export class GeminiHelper {
  private chat: ChatSession | null = null
  private model: GenerativeModel

  constructor(modelName = 'gemini-2.5-flash') {
    this.model = genAI.getGenerativeModel({ model: modelName })
    this.startNewChat() 
  }

  public startNewChat() {
    this.chat = this.model.startChat({
      history: [],
      systemInstruction: { role: 'model', parts: [{ text: CLUELY_SYSTEM_PROMPT }] },
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.NONE
        }
      }
    })
  }

  public async sendMessageStream(
    message: string,
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
    imageBase64?: string,
    audioBase64?: string
  ): Promise<void> {
    if (!this.chat) {
      throw new Error('Chat is not initialized.')
    }
    if (signal.aborted) return

    // The message can be a string or an array of parts (text, image, etc.)
    const messageParts: (string | { inlineData: { data: string; mimeType: string } })[] = [message]

    if (imageBase64) {
      messageParts.push({
        inlineData: {
          data: imageBase64,
          mimeType: 'image/png'
        }
      })
    }

    if (audioBase64) {
      messageParts.push({
        inlineData: {
          data: audioBase64,
          mimeType: 'audio/wav'
        }
      })
    }

    const streamResult = await this.chat.sendMessageStream(messageParts)

    for await (const chunk of streamResult.stream) {
      if (signal.aborted) {
        // The SDK doesn't have a stream.cancel(), so we just break the loop.
        break
      }
      console.log("[GeminiHelper] chunk.text()", chunk.text())
      onChunk(chunk.text())
    }
  }

  public resetChat() {
    this.startNewChat()
  }
}
