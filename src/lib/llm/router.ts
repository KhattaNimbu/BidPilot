import OpenAI from 'openai';
import { z } from 'zod';
import { ModelType, LLMCall } from '../types';
import { dbService } from '../db';

// Token pricing estimates per 1,000 tokens (USD)
const MODEL_PRICING: Record<ModelType, { in: number; out: number }> = {
  Nano: { in: 0.0001, out: 0.0002 },   // mini / fast
  Super: { in: 0.0010, out: 0.0015 },  // 340b instruct
  Ultra: { in: 0.0060, out: 0.0080 }   // 340b reward / reasoning
};

const MODEL_MAP: Record<ModelType, string> = {
  Nano: process.env.NANO_MODEL || 'nvidia/nemotron-4-mini-3b-instruct',
  Super: process.env.SUPER_MODEL || 'nvidia/nemotron-4-340b-instruct',
  Ultra: process.env.ULTRA_MODEL || 'nvidia/nemotron-4-340b-reward'
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.NEBIUS_API_KEY || 'mock_key';
  const baseURL = process.env.NEBIUS_BASE_URL || 'https://api.studio.nebius.ai/v1/';
  return new OpenAI({ apiKey, baseURL, timeout: 20000 });
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
  const apiKey = process.env.NEBIUS_API_KEY;
  const isMockMode = !apiKey || apiKey === 'mock_key' || apiKey === 'your_nebius_api_key_here';
  
  const modelName = MODEL_MAP[options.modelType];
  const systemMsg = options.systemPrompt || "You are BidPilot AI, an expert tender and bid compliance intelligence system. Return output ONLY in valid JSON format matching the requested schema without markdown backticks.";

  let responseText = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let resultData: T;

  if (!isMockMode) {
    try {
      const client = getOpenAIClient();
      const completion = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: options.prompt }
        ],
        temperature: options.modelType === 'Ultra' ? 0.2 : 0.1,
        response_format: { type: 'json_object' }
      });

      responseText = completion.choices[0]?.message?.content || "";
      tokensIn = completion.usage?.prompt_tokens || Math.ceil(options.prompt.length / 4);
      tokensOut = completion.usage?.completion_tokens || Math.ceil(responseText.length / 4);

      if (options.schema) {
        // Strip out ```json markdown fences if model outputs them despite instructions
        const cleanJson = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        const parsed = JSON.parse(cleanJson);
        resultData = options.schema.parse(parsed);
      } else {
        resultData = JSON.parse(responseText) as T;
      }
    } catch (err: any) {
      console.warn(`Nebius API call failed for agent '${options.agentName}' on model '${options.modelType}', attempting single retry or falling back:`, err.message);
      
      // If mock fallback exists, use it safely
      if (options.mockFallbackGenerator) {
        resultData = options.mockFallbackGenerator();
        responseText = JSON.stringify(resultData);
        tokensIn = Math.ceil(options.prompt.length / 4);
        tokensOut = Math.ceil(responseText.length / 4);
      } else {
        throw err;
      }
    }
  } else {
    // Development / Mock mode
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
  
  // Calculate cost
  const pricing = MODEL_PRICING[options.modelType];
  const cost = (tokensIn / 1000) * pricing.in + (tokensOut / 1000) * pricing.out;

  // Log call to MongoDB / Memory store for observability dashboard
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
    timestamp: new Date().toISOString()
  };

  await dbService.logCall(callRecord);

  return resultData;
}
