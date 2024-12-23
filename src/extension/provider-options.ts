import { USER } from "../common/constants"
import {
  apiProviders,
  FunctionTool,
  Message,
  RequestBodyBase,
  RequestOptionsOllama,
  StreamBodyOpenAI,
} from "../common/types"

export function createStreamRequestBody(
  provider: string,
  options: {
    temperature?: number
    numPredictChat?: number
    model: string
    messages?: Message[]
    keepAlive?: string | number
  },
  tools?: FunctionTool[],
): RequestBodyBase | RequestOptionsOllama | StreamBodyOpenAI {
  switch (provider) {
    case apiProviders.CustomOpenAI:
      return {
        model: options.model,
        stream: true,
        messages: options.messages,
        temperature: options.temperature
      }
    default:
      return {
        model: options.model,
        stream: !tools?.length,
        tools: tools,
        max_tokens: options.numPredictChat,
        messages: options.messages,
        temperature: options.temperature,
      }
  }
}

export function createStreamRequestBodyFim(
  provider: string,
  prompt: string,
  options: {
    temperature?: number
    numPredictFim: number
    model: string
    keepAlive?: string | number
  }
): RequestBodyBase | RequestOptionsOllama | StreamBodyOpenAI {
  switch (provider) {
    case apiProviders.CustomOpenAI:
      return {
        model: options.model,
        prompt,
        stream: true,
        temperature: options.temperature   
      }
    default:
      return {
        prompt,
        stream: true,
        temperature: options.temperature,
        n_predict: options.numPredictFim,
      }
  }
}
