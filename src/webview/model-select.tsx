import { VSCodeDropdown } from "@vscode/webview-ui-toolkit/react"

import { ApiModel } from "../common/types"

import { getModelShortName } from "./utils"

interface Props {
  model: string | undefined
  setModel: (model: ApiModel) => void
  models: ApiModel[] | undefined
}

export const ModelSelect1 = ({ model, models, setModel }: Props) => {
  const handleOnChange = (e: unknown): void => {
    const event = e as React.ChangeEvent<HTMLSelectElement>
    const selectedValue = event?.target.value || ""
    setModel(models?.find(model => model.model === selectedValue)!)
  }

  return (
    <VSCodeDropdown onChange={handleOnChange} value={model}>
      {models?.map((model, index) => {
        return (
          <option value={model.model} key={`${index}`}>
            {getModelShortName(model.model)}
          </option>
        )
      })}
    </VSCodeDropdown>
  )
}

export const ModelSelect2 = ({ model, models, setModel }: Props) => {

  const handleOnChange = (e: unknown): void => {
    const event = e as React.ChangeEvent<HTMLSelectElement>
    const selectedValue = event?.target.value || ""
    setModel(models?.find(model => `${model.name}_${model.source}(${model.model})` === selectedValue)!)
  }

  return (
    <VSCodeDropdown onChange={handleOnChange} value={model}>
      {
        models?.map((model, index) => {
          return (
            <option value={`${model.name}_${model.source}(${model.model})`} key={`${index}`}>
              {model.name}_{model.source}({model.model})
            </option>
          )
        })}
    </VSCodeDropdown>
  )
}