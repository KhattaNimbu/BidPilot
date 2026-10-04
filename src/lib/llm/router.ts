import OpenAI from 'openai';
import { z } from 'zod';
import { ModelType, LLMCall } from '../types';
import { dbService } from '../db';

// Token pricing estimates per 1,000 tokens (USD)
const MODEL_PRICING: Record<ModelType, { in: number; out: number }> = {
  Nano: { in: 0.0001, out: 0.0002 },   // Fast 8B instruct
  Super: { in: 0.0010, out: 0.0015 },  // 70B instruct / extraction & drafting
  Ultra: { in: 0.0060, out: 0.0080 }   // 70B deep reasoning / decision & scoring
};

// Nebius Token Factory chat model mappings
const MODEL_MAP: Record<ModelType, string> = {
  Nano: process.env.NANO_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct',
  Super: process.env.SUPER_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct',
  Ultra: process.env.ULTRA_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct'
};

export function isMockModeActive(): boolean {
  if (process.env.MOCK_MODE === 'true') return true;
  if (process.env.MOCK_MODE === 'false') return false;
  const apiKey = process.env.NEBIUS_API_KEY;
  return !apiKey || apiKey === 'mock_key' || apiKey === 'your_nebius_api_key_here';
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.NEBIUS_API_KEY || '';
  const baseURL = process.env.NEBIUS_BASE_URL || 'https://api.studio.nebius.ai/v1/';
  return new OpenAI({ apiKey, baseURL, timeout: 60000 });
}

export interface RouterOptions<T> {
  tenderId: string;
  agentName: string;
  modelType: ModelType;
  prompt: string;
  systemPrompt?: string;
  schema?: z.ZodType<T>;
  mockFallbackGenerator?: () => T;
}

export async function runRoutedLLM<T>(options: RouterOptions<T>): Promise<T> {
  const startTime = Date.now();
  const isMock = isMockModeActive();
  const modelName = MODEL_MAP[options.modelType];
  const systemMsg = options.systemPrompt || "You are BidPilot AI, an expert tender and bid compliance intelligence system. Return output ONLY in valid JSON format matching the requested schema without markdown backticks.";

  let responseText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let resultData!: T;
  let retryCount = 0;

  if (!isMock) {
    const client = getOpenAIClient();

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMsg },
        { role: 'user', content: options.prompt }
      ];

      const completion = await client.chat.completions.create({
        model: modelName,
        messages,
        temperature: options.modelType === 'Ultra' ? 0.2 : 0.1,
        response_format: { type: 'json_object' }
      });

      responseText = completion.choices[0]?.message?.content || "";
      tokensIn += completion.usage?.prompt_tokens || Math.ceil(options.prompt.length / 4);
      tokensOut += completion.usage?.completion_tokens || Math.ceil(responseText.length / 4);

      const rawJson = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

      // Parse JSON and validate against Zod schema
      try {
        const parsed = JSON.parse(rawJson);
        resultData = options.schema ? options.schema.parse(parsed) : (parsed as T);
      } catch (validationErr: any) {
        console.warn(`[Router] Initial validation failed for agent '${options.agentName}', attempting 1-turn Zod self-repair:`, validationErr.message);
        retryCount = 1;

        // 1-turn Zod self-repair retry
        const repairMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          ...messages,
          { role: 'assistant', content: responseText },
          { 
            role: 'user', 
            content: `Your previous output failed schema validation with error:\n${validationErr.message}\n\nPlease correct the errors and return ONLY strictly valid JSON matching the required schema.`
          }
        ];

        const repairCompletion = await client.chat.completions.create({
          model: modelName,
          messages: repairMessages,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        });

        const repairText = repairCompletion.choices[0]?.message?.content || "";
        tokensIn += repairCompletion.usage?.prompt_tokens || 200;
        tokensOut += repairCompletion.usage?.completion_tokens || 200;
        responseText = repairText;

        const cleanRepair = repairText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        const repairParsed = JSON.parse(cleanRepair);
        resultData = options.schema ? options.schema.parse(repairParsed) : (repairParsed as T);
      }
    } catch (err: any) {
      console.error(`[Router] Real Nebius call failed for agent '${options.agentName}' on model '${options.modelType}':`, err.message);

      // In Real Mode, log failure and THROW - never return canned fake data!
      const errorCall: LLMCall = {
        tender_id: options.tenderId,
        agent: options.agentName,
        model: options.modelType,
        model_name: modelName,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: Date.now() - startTime,
        cost: 0,
        input_preview: options.prompt.substring(0, 150) + "...",
        output_preview: `ERROR: ${err.message}`,
        timestamp: new Date().toISOString(),
        is_mock: false,
        error: err.message,
        retry_count: retryCount
      };
      await dbService.logCall(errorCall);
      throw new Error(`[Nebius API Error in ${options.agentName} (${options.modelType})]: ${err.message}`);
    }
  } else {
    // Explicit Mock Mode active
    if (options.mockFallbackGenerator) {
      resultData = options.mockFallbackGenerator();
      responseText = JSON.stringify(resultData);
    } else {
      throw new Error(`Mock mode active but no fallback generator provided for agent ${options.agentName}`);
    }
    tokensIn = Math.ceil((options.prompt.length + systemMsg.length) / 4);
    tokensOut = Math.ceil(responseText.length / 4);
  }

  const latency = Date.now() - startTime;
  const pricing = MODEL_PRICING[options.modelType];
  const cost = (tokensIn / 1000) * pricing.in + (tokensOut / 1000) * pricing.out;

  const callRecord: LLMCall = {
    tender_id: options.tenderId,
    agent: options.agentName,
    model: options.modelType,
    model_name: modelName,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: latency,
    cost: Number(cost.toFixed(6)),
    input_preview: options.prompt.substring(0, 150) + "...",
    output_preview: responseText.substring(0, 150) + "...",
    timestamp: new Date().toISOString(),
    is_mock: isMock,
    retry_count: retryCount
  };

  await dbService.logCall(callRecord);

  return resultData;
}
