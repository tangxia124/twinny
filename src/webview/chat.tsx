import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import Mention from "@tiptap/extension-mention"
import Placeholder from "@tiptap/extension-placeholder"
import { Editor, EditorContent, JSONContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  VSCodeBadge,
  VSCodeButton,
  VSCodeDivider,
  VSCodePanelView
} from "@vscode/webview-ui-toolkit/react"
import cn from "classnames"

import {
  ASSISTANT,
  EVENT_NAME,
  TOOL_EVENT_NAME,
  USER,
  WORKSPACE_STORAGE_KEY
} from "../common/constants"
import {
  ClientMessage,
  MentionType,
  Message,
  ServerMessage,
  Tool
} from "../common/types"

import useAutosizeTextArea, {
  useConversationHistory,
  useSelection,
  useSuggestion,
  useTheme,
  useWorkSpaceContext
} from "./hooks"
import { DisabledAutoScrollIcon, EnabledAutoScrollIcon } from "./icons"
import ChatLoader from "./loader"
import { Message as MessageComponent } from "./message"
import { ProviderSelect } from "./provider-select"
import { Suggestions } from "./suggestions"
import { CustomKeyMap } from "./utils"

import styles from "./styles/index.module.css"

interface ChatProps {
  fullScreen?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const global = globalThis as any
export const Chat = (props: ChatProps): JSX.Element => {
  const { fullScreen } = props
  const generatingRef = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const stopRef = useRef(false)
  const theme = useTheme()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>()
  const [completion, setCompletion] = useState<Message | null>()
  const markdownRef = useRef<HTMLDivElement>(null)
  const { context: autoScrollContext, setContext: setAutoScrollContext } =
    useWorkSpaceContext<boolean>(WORKSPACE_STORAGE_KEY.autoScroll)
  const { context: showProvidersContext, setContext: setShowProvidersContext } =
    useWorkSpaceContext<boolean>(WORKSPACE_STORAGE_KEY.showProviders)
  const {
    context: showEmbeddingOptionsContext,
    setContext: setShowEmbeddingOptionsContext
  } = useWorkSpaceContext<boolean>(WORKSPACE_STORAGE_KEY.showEmbeddingOptions)
  const { conversation, saveLastConversation, setActiveConversation } =
    useConversationHistory()

  const chatRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    if (!autoScrollContext) return
    setTimeout(() => {
      if (markdownRef.current) {
        markdownRef.current.scrollTop = markdownRef.current.scrollHeight
      }
    }, 200)
  }

  const selection = useSelection(scrollToBottom)

  const handleCompletionEnd = (message: ServerMessage<Message>) => {
    if (!message.data) {
      setCompletion(null)
      setIsLoading(false)
      generatingRef.current = false
      return
    }

    setMessages((prev) => {
      if (message.data.id) {
        const existingIndex = prev?.findIndex((m) => m.id === message.data.id)

        if (existingIndex !== -1) {
          const updatedMessages = [...(prev || [])]

          updatedMessages[existingIndex || 0] = message.data

          saveLastConversation({
            ...conversation,
            messages: updatedMessages
          })
          return updatedMessages
        }
      }

      const messages = [...(prev || []), message.data]
      saveLastConversation({
        ...conversation,
        messages: messages
      })
      return messages
    })

    setTimeout(() => {
      editorRef.current?.commands.focus()
      stopRef.current = false
    }, 200)

    setCompletion(null)
    setIsLoading(false)
    generatingRef.current = false
  }

  const handleAddTemplateMessage = (message: ServerMessage<Message>) => {
    if (stopRef.current) {
      generatingRef.current = false
      return
    }
    generatingRef.current = true
    setIsLoading(false)
    scrollToBottom()
    setMessages((prev) => [...(prev || []), message.data])
  }

  const handleCompletionMessage = (message: ServerMessage<Message>) => {
    if (stopRef.current) {
      generatingRef.current = false
      return
    }
    setCompletion(message.data)
    scrollToBottom()
  }

  const handleLoadingMessage = () => {
    setIsLoading(true)
    if (autoScrollContext) scrollToBottom()
  }

  const messageEventHandler = (event: MessageEvent) => {
    const message: ServerMessage = event.data
    switch (message.type) {
      case EVENT_NAME.twinnyAddMessage: {
        handleAddTemplateMessage(message as ServerMessage<Message>)
        break
      }
      case EVENT_NAME.twinnyOnCompletion: {
        handleCompletionMessage(message as ServerMessage<Message>)
        break
      }
      case EVENT_NAME.twinnyOnLoading: {
        handleLoadingMessage()
        break
      }
      case EVENT_NAME.twinnyOnCompletionEnd: {
        handleCompletionEnd(message as ServerMessage<Message>)
        break
      }
      case EVENT_NAME.twinnyStopGeneration: {
        setCompletion(null)
        generatingRef.current = false
        setIsLoading(false)
        chatRef.current?.focus()
        setActiveConversation(undefined)
        setMessages([])
        setTimeout(() => {
          stopRef.current = false
        }, 1000)
      }
    }
  }

  const handleStopGeneration = () => {
    stopRef.current = true
    global.vscode.postMessage({
      type: EVENT_NAME.twinnyStopGeneration
    } as ClientMessage)
    setCompletion(null)
    setIsLoading(false)
    generatingRef.current = false
    setTimeout(() => {
      chatRef.current?.focus()
      stopRef.current = false
    }, 200)
  }

  const handleRegenerateMessage = (index: number): void => {
    setIsLoading(true)
    setMessages((prev) => {
      if (!prev) return prev
      const updatedMessages = prev.slice(0, index)

      global.vscode.postMessage({
        type: EVENT_NAME.twinnyChatMessage,
        data: updatedMessages
      } as ClientMessage)

      return updatedMessages
    })
  }

  const handleDeleteMessage = (index: number): void => {
    setMessages((prev) => {
      if (!prev || prev.length === 0) return prev

      if (prev.length === 2) return prev

      const updatedMessages = [
        ...prev.slice(0, index),
        ...prev.slice(index + 2)
      ]

      saveLastConversation({
        ...conversation,
        messages: updatedMessages
      })

      return updatedMessages
    })
  }

  const handleEditMessage = (message: string, index: number): void => {
    setIsLoading(true)
    setMessages((prev) => {
      if (!prev) return prev

      const updatedMessages = [
        ...prev.slice(0, index),
        { ...prev[index], content: message }
      ]

      global.vscode.postMessage({
        type: EVENT_NAME.twinnyChatMessage,
        data: updatedMessages
      } as ClientMessage)

      return updatedMessages
    })
  }

  const getMentions = () => {
    const mentions: MentionType[] = []
    editorRef.current?.getJSON().content?.forEach((node) => {
      if (node.type === "paragraph" && Array.isArray(node.content)) {
        node.content.forEach((innerNode: JSONContent) => {
          if (innerNode.type === "mention" && innerNode.attrs) {
            mentions.push({
              name:
                innerNode.attrs.label ||
                innerNode.attrs.id.split("/").pop() ||
                "",
              path: innerNode.attrs.id
            })
          }
        })
      }
    })

    return mentions
  }

  const replaceMentionsInText = useCallback(
    (text: string, mentions: MentionType[]): string => {
      return mentions.reduce(
        (result, mention) => result.replace(mention.path, `@${mention.name}`),
        text
      )
    },
    []
  )

  const handleSubmitForm = () => {
    const input = editorRef.current?.getText().trim()

    if (!input || generatingRef.current) return

    generatingRef.current = true

    const mentions = getMentions()

    setIsLoading(true)
    clearEditor()
    setMessages((prevMessages) => {
      const updatedMessages = [
        ...(prevMessages || []),
        { role: USER, content: replaceMentionsInText(input, mentions) }
      ]

      const clientMessage: ClientMessage<Message[], MentionType[]> = {
        type: EVENT_NAME.twinnyChatMessage,
        data: updatedMessages,
        meta: mentions
      }

      saveLastConversation({
        ...conversation,
        messages: updatedMessages
      })

      global.vscode.postMessage(clientMessage)

      return updatedMessages
    })

    setTimeout(() => {
      if (markdownRef.current) {
        markdownRef.current.scrollTop = markdownRef.current.scrollHeight
      }
    }, 200)
  }

  const clearEditor = useCallback(() => {
    editorRef.current?.commands.clearContent()
  }, [])

  const handleToggleAutoScroll = () => {
    setAutoScrollContext((prev) => {
      global.vscode.postMessage({
        type: EVENT_NAME.twinnySetWorkspaceContext,
        key: WORKSPACE_STORAGE_KEY.autoScroll,
        data: !prev
      } as ClientMessage)

      if (!prev) scrollToBottom()

      return !prev
    })
  }

  const handleToggleProviderSelection = () => {
    setShowProvidersContext((prev) => {
      global.vscode.postMessage({
        type: EVENT_NAME.twinnySetWorkspaceContext,
        key: WORKSPACE_STORAGE_KEY.showProviders,
        data: !prev
      } as ClientMessage)
      return !prev
    })
  }

  const handleScrollBottom = () => {
    if (markdownRef.current) {
      markdownRef.current.scrollTop = markdownRef.current.scrollHeight
    }
  }

  const handleNewConversation = () => {
    global.vscode.postMessage({
      type: EVENT_NAME.twinnyNewConversation
    })
  }

  const handleRejectTool = (message: Message, tool: Tool) => {
    global.vscode.postMessage({
      type: TOOL_EVENT_NAME.rejectTool,
      data: {
        message,
        tool
      }
    } as ClientMessage<{ message: Message; tool: Tool }>)
  }

  const handleRunTool = (message: Message, tool: Tool) => {
    global.vscode.postMessage({
      type: TOOL_EVENT_NAME.runTool,
      data: {
        message,
        tool
      }
    } as ClientMessage<{ message: Message; tool: Tool }>)
  }

  const handleRunAllTools = (message: Message) => {
    global.vscode.postMessage({
      type: TOOL_EVENT_NAME.runAllTools,
      data: message
    } as ClientMessage<Message>)
  }

  useEffect(() => {
    global.vscode.postMessage({
      type: EVENT_NAME.twinnyHideBackButton
    })
  }, [])

  useEffect(() => {
    window.addEventListener("message", messageEventHandler)
    editorRef.current?.commands.focus()
    scrollToBottom()
    return () => {
      window.removeEventListener("message", messageEventHandler)
    }
  }, [autoScrollContext])

  useEffect(() => {
    if (conversation?.messages?.length) {
      return setMessages(conversation.messages)
    }
  }, [conversation?.id, autoScrollContext, showProvidersContext])

  const { suggestion, filePaths } = useSuggestion()

  const memoizedSuggestion = useMemo(
    () => suggestion,
    [JSON.stringify(filePaths)]
  )

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Mention.configure({
          HTMLAttributes: {
            class: "mention"
          },
          suggestion: memoizedSuggestion,
          renderText({ node }) {
            if (node.attrs.name) {
              return `${node.attrs.name ?? node.attrs.id}`
            }
            return node.attrs.id ?? ""
          }
        }),
        CustomKeyMap.configure({
          handleSubmitForm,
          clearEditor
        }),
        Placeholder.configure({
          placeholder: t("placeholder") // "How can twinny help you today?",
        })
      ]
    },
    [memoizedSuggestion]
  )

  useAutosizeTextArea(chatRef, editorRef.current?.getText() || "")

  useEffect(() => {
    if (editor) editorRef.current = editor
    editorRef.current?.commands.focus()
  }, [editor])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.extensionManager.extensions.forEach((extension) => {
        if (extension.name === "mention") {
          extension.options.suggestion = memoizedSuggestion
        }
      })
    }
  }, [memoizedSuggestion])

  return (
    <VSCodePanelView>
      <div className={styles.container}>

        <div>
          {!conversation && (<div className={styles.text}>

            <h1 className={styles.textHead}>对话</h1>
            <div>
              <h3 className={styles.textSubHead}>打开侧边栏</h3>
              <p>要使用 Twinny 聊天，可以通过 VSCode 侧边栏访问。Twinny 会在会话之间保留聊天历史记录。您可以通过点击顶部面板上的“历史”图标来查看聊天历史。</p>
              <h3 className={styles.textSubHead}>上下文与代码选择</h3>
              <p>当您在编辑器中高亮/选择代码时，Twinny 会将其作为聊天消息的上下文。如果您没有选择任何代码，它将仅使用消息本身以及之前的消息。您也可以右键点击选中的代码，选择 Twinny 选项来进行重构、解释或执行其他操作。</p>
            </div>

            <h1 className={styles.textHead}>自动补全</h1>
            <div>
              <p>要使用 Twinny 自动补全代码片段，只需在编辑器中开始输入，Twinny 就会为您自动补全。</p>
              <p>如果您希望手动触发代码补全，可以在设置菜单中关闭自动内联代码补全（该菜单位于 Twinny 侧边面板顶部），然后使用快捷键 <code dir="auto">ALT+\</code> 来触发代码补全。</p>
            </div>

            <h1 className={styles.textHead}>键盘快捷键</h1>
            <table><thead><tr><th>快捷键</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">ALT+\</code></td><td>触发内联代码补全</td></tr><tr><td><code dir="auto">CTRL+SHIFT+/</code></td><td>停止内联代码生成</td></tr><tr><td><code dir="auto">Tab</code></td><td>接受生成的内联代码</td></tr></tbody></table>

          </div>
          )}
        </div>

        {!!fullScreen && (
          <div className={styles.fullScreenActions}>
            <VSCodeButton
              onClick={handleNewConversation}
              appearance="icon"
              title={t("new-conversation")}
            >
              <i className="codicon codicon-comment-discussion" />
            </VSCodeButton>
          </div>
        )}
        <h4 className={styles.title}>
          {conversation?.title
            ? conversation?.title
            : generatingRef.current && <span>New conversation</span>}
        </h4>
        <div
          className={cn({
            [styles.markdown]: !fullScreen,
            [styles.markdownFullScreen]: fullScreen
          })}
          ref={markdownRef}
        >
          {messages?.map((message, index) => (
            <MessageComponent
              key={index}
              onRegenerate={handleRegenerateMessage}
              onUpdate={handleEditMessage}
              onDelete={handleDeleteMessage}
              isLoading={isLoading || generatingRef.current}
              isAssistant={index % 2 !== 0}
              conversationLength={messages?.length}
              message={message}
              theme={theme}
              index={index}
              onRejectTool={handleRejectTool}
              onRunTool={handleRunTool}
              onRunAllTools={handleRunAllTools}
            />
          ))}
          {isLoading && !completion ? (
            <ChatLoader />
          ) : (
            !!completion && (
              <MessageComponent
                isLoading={false}
                isAssistant
                theme={theme}
                message={{
                  ...completion,
                  role: ASSISTANT
                }}
              />
            )
          )}
        </div>
        {!!selection.length && (
          <Suggestions isDisabled={!!generatingRef.current} />
        )}
        {showProvidersContext && <ProviderSelect />}
        <div className={styles.chatOptions}>
          <div>
            <VSCodeButton
              onClick={handleToggleAutoScroll}
              title={t("toggle-auto-scroll")}
              appearance="icon"
            >
              {autoScrollContext ? (
                <EnabledAutoScrollIcon />
              ) : (
                <DisabledAutoScrollIcon />
              )}
            </VSCodeButton>
            <VSCodeButton
              title={t("scroll-down")}
              appearance="icon"
              onClick={handleScrollBottom}
            >
              <span className="codicon codicon-arrow-down"></span>
            </VSCodeButton>
            <VSCodeBadge>{selection?.length}</VSCodeBadge>
          </div>
          <div>
            {generatingRef.current && (
              <VSCodeButton
                type="button"
                appearance="icon"
                onClick={handleStopGeneration}
                aria-label={t("stop-generation")}
              >
                <span className="codicon codicon-debug-stop"></span>
              </VSCodeButton>
            )}
            {(
              <>
                <VSCodeButton
                  title={t("toggle-provider-selection")}
                  appearance="icon"
                  onClick={handleToggleProviderSelection}
                >
                  <span className="codicon codicon-keyboard"></span>
                </VSCodeButton>
              </>
            )}
          </div>
        </div>
        <form>
          <div className={styles.chatBox}>
            <EditorContent
              className={styles.tiptap}
              editor={editorRef.current}
            />
            <div
              role="button"
              onClick={handleSubmitForm}
              className={styles.chatSubmit}
            >
              <span className="codicon codicon-send"></span>
            </div>
          </div>
        </form>
      </div>
    </VSCodePanelView>
  )
}
