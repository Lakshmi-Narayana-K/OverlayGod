import { Groq } from "groq-sdk";
import { z } from "zod";

const GROQ_API_KEY =
  (import.meta as any).env?.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
  throw new Error(
    'GROQ_API_KEY is not set. Ensure it exists in .env or as a system env variable, or that it is defined in Vite env files.'
  );
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Define a schema with Zod for the expected JSON response
const ActionSchema = z.object({
  actions: z.array(z.string()).default([]),
});

export class GroqHelper {
  private readonly modelName: string;

  constructor(modelName: string = "qwen/qwen3-32b") {
    this.modelName = modelName;
  }

  public async streamQuestions(
    prevQuestions: string[],
    currentTranscript: string,
    onChunk: (chunk: string) => void
  ): Promise<z.infer<typeof ActionSchema>> {
    console.warn('GroqHelper: streamQuestions called with:', { prevQuestions, currentTranscript });
    const systemContent = JSON.stringify({
      role: "system",
      content: "You are a real-time assistant that analyzes live call transcripts to extract the most relevant and high-utility questions the user needs answered at that moment. Your output helps guide a **smarter AI assistant** that will act on the user’s behalf.\n\nYour output must follow this JSON format only:\n{\n  \"actions\": [\n    \"🧠 Example question 1 in the voice of the user\",\n    \"💡 Example question 2 in the voice of the user\"\n  ]\n}\n\nRules:\n- Always write actions/questions **in the voice of the user** (e.g., \"What should I do if...\", \"Can you explain why...\").\n- These actions are **not used by the user**, but forwarded to another assistant — so clarity and precision are critical.\n- **Start each question with a relevant emoji** that reflects the topic or tone (e.g., ❓, 📊, ⚠️, 🤔).\n- **Prioritize utility and relevance over length.** Keep questions concise but meaningful.\n- Retain previously suggested questions only if they are still relevant and high priority. Replace or remove otherwise.\n- Do not include explanations or commentary — just return the list of questions in JSON format.",
    }); // System message for Groq

    const userContent = `Here are the previous questions you suggested:\n<prev_questions>\n${prevQuestions.join('\n')}\n</prev_questions>\n\nupdated call transcript and list the most urgent, high-value questions I currently need answered:\n<current_transcript>\n${currentTranscript}\n</current_transcript>`; // User message with previous questions and current transcript

    let fullResponseContent = ""; // Accumulator for the full streamed response
    console.warn('GroqHelper: Initializing Groq client and streaming...');

    const stream = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemContent }, // System message for the assistant's behavior
        { role: "user", content: userContent }, // User message with context for analysis
      ],
      model: this.modelName, // Model to use for generating completions
      response_format: { type: "json_object" }, // Ensure the response is a JSON object
      stream: true, // Enable streaming for partial message deltas
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''; // Extract content from each chunk
      fullResponseContent += content; // Accumulate content
      onChunk(content); // Call the callback with each chunk
    }

    // Parse and validate JSON after the stream is complete
    try {
      const jsonData = JSON.parse(fullResponseContent);
      console.warn('GroqHelper: Full response content:', fullResponseContent);
      const validated = ActionSchema.parse(jsonData);
      console.warn('GroqHelper: Parsed and validated actions:', validated.actions);
      return validated; // Return validated data
    } catch (error) {
      console.error("Error parsing or validating Groq response:", error);
      throw error; // Re-throw the error for upstream handling
    }
  }
}
