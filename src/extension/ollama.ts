import { workspace } from "vscode"

export class OllamaService {
  private _config = workspace.getConfiguration("twinny")
  private _baseUrl: string

  constructor() {
    const protocol = (this._config.get("ollamaUseTls") as boolean)
      ? "https"
      : "http"
    const hostname = this._config.get("ollamaHostname") as string
    this._baseUrl = `${protocol}://${hostname}`
  }

  public fetchModels = async (resource = "/v1/model") => {
    try {
      const response = await fetch(`${this._baseUrl}${resource}`)
      const models = await response.json()
      return models
    } catch (err) {
      return []
    }
  }
}
