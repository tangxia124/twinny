import { USER } from "../common/constants"
import {
  apiProviders,
  FunctionTool,
  Message,
  RequestBodyBase,
  RequestOptionsOllama
} from "../common/types"

export function createStreamRequestBody(
  _provider: string,
  options: {
    temperature?: number
    model: string
    messages?: Message[]
    max_tokens?: number
  },
  _tools?: FunctionTool[],
): RequestOptionsOllama {
  return {
    model: options.model,
    stream: true,
    messages: options.messages,
    temperature: options.temperature,
    max_tokens: options.max_tokens
  }
}

export function createStreamRequestBodyFim(
  _provider: string,
  prompt: string,
  options: {
    temperature?: number
    model: string
    max_tokens?: number
  }
): RequestOptionsOllama {
  return {
    model: options.model,
    prompt,
    stream: true,
    temperature: options.temperature,
    max_tokens: options.max_tokens
  }

}

