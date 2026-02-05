// Unified LLM Service - Supports OpenAI, Mistral, and Anthropic
import { config } from '../config/env.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

interface ChatCompletionResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// API response types for type-safe JSON parsing
interface OpenAIResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface MistralResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface AnthropicResponse {
  content: { text: string }[];
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Unified LLM client that supports multiple providers
 */
class LLMClient {
  private provider: 'openai' | 'mistral' | 'anthropic';
  private apiKey: string;

  constructor() {
    this.provider = config.llm.provider;

    // Get the appropriate API key based on provider
    switch (this.provider) {
      case 'openai':
        if (!config.llm.openaiApiKey) {
          throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai');
        }
        this.apiKey = config.llm.openaiApiKey;
        break;
      case 'mistral':
        if (!config.llm.mistralApiKey) {
          throw new Error('MISTRAL_API_KEY is required when LLM_PROVIDER=mistral');
        }
        this.apiKey = config.llm.mistralApiKey;
        break;
      case 'anthropic':
        if (!config.llm.anthropicApiKey) {
          throw new Error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic');
        }
        this.apiKey = config.llm.anthropicApiKey;
        break;
    }

    console.log(`[LLM] Using provider: ${this.provider}`);
  }

  /**
   * Create a chat completion using the configured provider
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    switch (this.provider) {
      case 'openai':
        return this.openaiCompletion(options);
      case 'mistral':
        return this.mistralCompletion(options);
      case 'anthropic':
        return this.anthropicCompletion(options);
    }
  }

  private async openaiCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        ...(options.jsonMode && { response_format: { type: 'json_object' } }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as OpenAIResponse;
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    };
  }

  private async mistralCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-medium-latest', // Best quality/price ratio
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        ...(options.jsonMode && { response_format: { type: 'json_object' } }),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${error}`);
    }

    const data = await response.json() as MistralResponse;
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
    };
  }

  private async anthropicCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    // Extract system message and convert to Anthropic format
    const systemMessage = options.messages.find((m) => m.role === 'system')?.content || '';
    const userMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Add JSON instruction to system prompt if needed
    const systemPrompt = options.jsonMode
      ? `${systemMessage}\n\nIMPORTANT: Respond with valid JSON only, no other text.`
      : systemMessage;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Fast and cheap, good for quiz generation
        system: systemPrompt,
        messages: userMessages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json() as AnthropicResponse;
    return {
      content: data.content[0].text,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
    };
  }
}

// Export singleton instance
let llmClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient();
  }
  return llmClient;
}

// Convenience function for simple completions
export async function generateText(
  prompt: string,
  options?: { system?: string; temperature?: number; jsonMode?: boolean }
): Promise<string> {
  const client = getLLMClient();
  const messages: ChatMessage[] = [];

  if (options?.system) {
    messages.push({ role: 'system', content: options.system });
  }
  messages.push({ role: 'user', content: prompt });

  const result = await client.chatCompletion({
    messages,
    temperature: options?.temperature,
    jsonMode: options?.jsonMode,
  });

  return result.content;
}
