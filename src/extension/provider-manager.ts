import { v4 as uuidv4 } from "uuid"
import { ExtensionContext, Webview } from "vscode"

import {
  ACTIVE_CHAT_PROVIDER_STORAGE_KEY,
  ACTIVE_FIM_PROVIDER_STORAGE_KEY,
  FIM_TEMPLATE_FORMAT,
  INFERENCE_PROVIDERS_STORAGE_KEY,
  PROVIDER_EVENT_NAME,
  WEBUI_TABS,
} from "../common/constants"
import { apiProviders, ClientMessage, ServerMessage } from "../common/types"

export interface TwinnyProvider {
  apiHostname: string
  apiPath: string
  apiProtocol: string
  id: string
  label: string
  modelName: string
  provider: string
  type: string
  apiKey?: string
  fimTemplate?: string
  repositoryLevel?: boolean
  temperature?: number
  maxTokens?: number
}

type Providers = Record<string, TwinnyProvider> | undefined

export class ProviderManager {
  _context: ExtensionContext
  _webView: Webview

  constructor(context: ExtensionContext, webviewView: Webview) {
    this._context = context
    this._webView = webviewView
    this.setUpEventListeners()
    this.addDefaultProviders()
  }

  setUpEventListeners() {
    this._webView?.onDidReceiveMessage(
      (message: ClientMessage<TwinnyProvider>) => {
        this.handleMessage(message)
      }
    )
  }

  handleMessage(message: ClientMessage<TwinnyProvider>) {
    const { data: provider } = message
    switch (message.type) {
      case PROVIDER_EVENT_NAME.addProvider:
        return this.addProvider(provider)
      case PROVIDER_EVENT_NAME.removeProvider:
        return this.removeProvider(provider)
      case PROVIDER_EVENT_NAME.updateProvider:
        return this.updateProvider(provider)
      case PROVIDER_EVENT_NAME.getActiveChatProvider:
        return this.getActiveChatProvider()
      case PROVIDER_EVENT_NAME.getActiveFimProvider:
        return this.getActiveFimProvider()
      case PROVIDER_EVENT_NAME.setActiveChatProvider:
        return this.setActiveChatProvider(provider)
      case PROVIDER_EVENT_NAME.setActiveFimProvider:
        return this.setActiveFimProvider(provider)
      case PROVIDER_EVENT_NAME.copyProvider:
        return this.copyProvider(provider)
      case PROVIDER_EVENT_NAME.getAllProviders:
        return this.getAllProviders()
      case PROVIDER_EVENT_NAME.resetProvidersToDefaults:
        return this.resetProvidersToDefaults()
    }
  }

  public focusProviderTab = () => {
    this._webView.postMessage({
      type: PROVIDER_EVENT_NAME.focusProviderTab,
      data: WEBUI_TABS.providers,
    } as ServerMessage<string>)
  }

  getDefaultChatProvider() {
    return {
      apiHostname: "http://llm.htffund.com",
      apiPath: "/v1/chat/completions",
      apiProtocol: "http",
      id: uuidv4(),
      label: "CodeQwen",
      modelName: "Qwen2_5-Coder-32B-Instruct-AWQ",
      provider: apiProviders.CustomOpenAI,
      type: "chat",
      apiKey: "sk-iLiWSbLYunZDVpHVyZrmuA",
      temperature: 0.1,
      maxTokens: 1024
    } as TwinnyProvider
    }

  getDefaultFimProvider() {
    return {
      apiHostname: "http://llm.htffund.com",
      apiPath: "/v1/completions",
      apiProtocol: "http",
      fimTemplate: FIM_TEMPLATE_FORMAT.codeqwen,
      label: "CodeQwen",
      id: uuidv4(),
      modelName: "Qwen2_5-Coder-32B-Instruct-AWQ",
      provider: apiProviders.CustomOpenAI,
      apiKey: "sk-iLiWSbLYunZDVpHVyZrmuA",
      type: "fim",
      temperature: 0.1,
      maxTokens: 1024
    } as TwinnyProvider
  }

  addDefaultProviders() {
    this.addDefaultChatProvider()
    this.addDefaultFimProvider()
  }

  addDefaultChatProvider(): TwinnyProvider {
    const provider = this.getDefaultChatProvider()
    if (!this._context.globalState.get(ACTIVE_CHAT_PROVIDER_STORAGE_KEY)) {
      this.addDefaultProvider(provider)
    }
    return provider
  }

  addDefaultFimProvider(): TwinnyProvider {
    const provider = this.getDefaultFimProvider()
    if (!this._context.globalState.get(ACTIVE_FIM_PROVIDER_STORAGE_KEY)) {
      this.addDefaultProvider(provider)
    }
    return provider
  }

  addDefaultProvider(provider: TwinnyProvider): void {
    if (provider.type === "chat") {
      this._context.globalState.update(
        ACTIVE_CHAT_PROVIDER_STORAGE_KEY,
        provider
      )
    } else if (provider.type === "fim") {
      this._context.globalState.update(
        ACTIVE_FIM_PROVIDER_STORAGE_KEY,
        provider
      )
    }
    this.addProvider(provider)
  }

  getProviders(): Providers {
    const providers = this._context.globalState.get<
      Record<string, TwinnyProvider>
    >(INFERENCE_PROVIDERS_STORAGE_KEY)
    return providers
  }

  getAllProviders() {
    const providers = this.getProviders() || {}
    this._webView?.postMessage({
      type: PROVIDER_EVENT_NAME.getAllProviders,
      data: providers,
    })
  }

  getActiveChatProvider() {
    const provider = this._context.globalState.get<TwinnyProvider>(
      ACTIVE_CHAT_PROVIDER_STORAGE_KEY
    )
    this._webView?.postMessage({
      type: PROVIDER_EVENT_NAME.getActiveChatProvider,
      data: provider,
    })
    return provider
  }

  getActiveFimProvider() {
    const provider = this._context.globalState.get<TwinnyProvider>(
      ACTIVE_FIM_PROVIDER_STORAGE_KEY
    )
    this._webView?.postMessage({
      type: PROVIDER_EVENT_NAME.getActiveFimProvider,
      data: provider,
    })
    return provider
  }

  setActiveChatProvider(provider?: TwinnyProvider) {
    if (!provider) return
    this._context.globalState.update(ACTIVE_CHAT_PROVIDER_STORAGE_KEY, provider)
    return this.getActiveChatProvider()
  }

  setActiveFimProvider(provider?: TwinnyProvider) {
    if (!provider) return
    this._context.globalState.update(ACTIVE_FIM_PROVIDER_STORAGE_KEY, provider)
    return this.getActiveFimProvider()
  }

  addProvider(provider?: TwinnyProvider) {
    const providers = this.getProviders() || {}
    if (!provider) return
    provider.id = uuidv4()
    providers[provider.id] = provider
    this._context.globalState.update(INFERENCE_PROVIDERS_STORAGE_KEY, providers)
    this.getAllProviders()
  }

  copyProvider(provider?: TwinnyProvider) {
    if (!provider) return
    provider.id = uuidv4()
    provider.label = `${provider.label}-copy`
    this.addProvider(provider)
  }

  removeProvider(provider?: TwinnyProvider) {
    const providers = this.getProviders() || {}
    if (!provider) return
    delete providers[provider.id]
    this._context.globalState.update(INFERENCE_PROVIDERS_STORAGE_KEY, providers)
    this.getAllProviders()
  }

  updateProvider(provider?: TwinnyProvider) {
    const providers = this.getProviders() || {}
    const activeFimProvider = this.getActiveFimProvider()
    const activeChatProvider = this.getActiveChatProvider()
    if (!provider) return
    providers[provider.id] = provider
    this._context.globalState.update(INFERENCE_PROVIDERS_STORAGE_KEY, providers)
    if (provider.id === activeFimProvider?.id)
      this.setActiveFimProvider(provider)
    if (provider.id === activeChatProvider?.id)
      this.setActiveChatProvider(provider)
    this.getAllProviders()
  }

  resetProvidersToDefaults(): void {
    this._context.globalState.update(INFERENCE_PROVIDERS_STORAGE_KEY, undefined)
    this._context.globalState.update(
      ACTIVE_CHAT_PROVIDER_STORAGE_KEY,
      undefined
    )
    this._context.globalState.update(ACTIVE_FIM_PROVIDER_STORAGE_KEY, undefined)
    const chatProvider = this.addDefaultChatProvider()
    const fimProvider = this.addDefaultFimProvider()
    this.focusProviderTab()
    this.setActiveChatProvider(chatProvider)
    this.setActiveFimProvider(fimProvider)
    this.getAllProviders()
  }
}
