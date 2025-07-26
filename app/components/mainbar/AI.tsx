import { useState, useEffect, useRef } from 'react'
import { useSelector } from '@xstate/react'
import { useUIActor } from '../../state/UIStateProvider'
import { Input } from '../ui/input'
import { Command, CornerDownLeft, Mic, MicOff } from 'lucide-react'
import MarkdownRenderer from '../MarkdownRenderer'
import TranscriptPane from '../TranscriptPane'

interface AIProps {
  isChatPaneVisible: boolean
  onContentChange?: (isWide: boolean) => void
}

export const AI: React.FC<AIProps> = ({ isChatPaneVisible, onContentChange }) => {
  const actor = useUIActor()
  const { send } = actor
  const [isGeminiMuted, setIsGeminiMuted] = useState(false) // State for Gemini mute status

  const { state, isChatIdle, isChatLoading, isChatError, isLiveActive } = useSelector(actor, (s) => ({
    state: s,
    isChatIdle: s.matches({ chat: 'idle' }),
    isChatLoading: s.matches({ chat: 'loading' }),
    isChatError: s.matches({ chat: 'error' }),
    isLiveActive: s.matches('live'),
  }))

  const [answer, setAnswer] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)
  // --- Streaming control refs ---
  const resetIsPending = useRef(false) // True immediately after a `reset` signal until we determine what to do
  const firstChunkBuffer = useRef('') // Accumulates the first chunk(s) to detect <NONE/> or <APPEND/>
  const skipResponse = useRef(false) // If current turn should be ignored (<NONE/>)
  const appendMode = useRef(false) // If we should just append (<APPEND/>) instead of replacing

  // Streamed chunk listener (legacy)
  // useEffect(() => {
  //   const handleChunk = (chunk: string) => {
  //     setAnswer((prev) => (prev || '') + chunk);
  //   };
  //   window.api.receive('chat:chunk', handleChunk);
  //   return () => {
  //     window.api.removeAllListeners('chat:chunk');
  //   };
  // }, []);

  useEffect(() => {
    if (state.matches('activeIdle')) {
      setAnswer(null)
      setErrorMessage(null)
      setInputValue('')
    } else if (isChatLoading) {
      setAnswer('')
      setErrorMessage(null)
    }
  }, [state, isChatLoading])

  useEffect(() => {
    const handleStreamChunk = (chunk: { text?: string; reset?: boolean }) => {
      // 1. Handle the reset flag (start of a new turn)
      if (chunk.reset) {
        console.log('[AI.tsx] handleStreamChunk: Reset signal received. Preparing for new turn.')
        resetIsPending.current = true
        firstChunkBuffer.current = ''
        skipResponse.current = false
        appendMode.current = false
        // return; // Wait for first text chunk to decide behaviour
      }

      if (!chunk.text) {
        console.log('[AI.tsx] handleStreamChunk: Received empty text chunk. Skipping.')
        return
      }

      console.log('[AI.tsx] handleStreamChunk: Processing chunk:', chunk.text)

      // Helper to append text and update width heuristics
      const addContent = (text: string) => {
        if (!text) return
        setAnswer((prev) => {
          const base = prev || ''
          const newAnswer = base + text
          const containsCode = /```/.test(newAnswer)
          const wordCount = newAnswer.split(/\s+/).filter(Boolean).length
          const shouldBeWide = containsCode || wordCount > 100
          onContentChange?.(shouldBeWide)
          return newAnswer
        })
      }

      // 2. We're still awaiting the first meaningful chunk after reset
      if (resetIsPending.current) {
        console.log('[AI.tsx] handleStreamChunk: Reset pending. Buffering first chunk:', chunk.text)
        firstChunkBuffer.current += chunk.text

        // If we haven't received the end of the tag yet, keep buffering
        if (firstChunkBuffer.current.startsWith('<') && !firstChunkBuffer.current.includes('>')) {
          console.log('[AI.tsx] handleStreamChunk: Buffering incomplete tag. Current buffer:', firstChunkBuffer.current)
          return
        }

        const buf = firstChunkBuffer.current
        console.log('[AI.tsx] handleStreamChunk: First chunk buffer complete. Processing buffer:', buf)

        if (buf.startsWith('<NONE/>')) {
          console.log('[AI.tsx] handleStreamChunk: Detected <NONE/> tag. Skipping response.')
          skipResponse.current = true
          resetIsPending.current = false
          return
        }

        if (buf.startsWith('<APPEND/>')) {
          console.log('[AI.tsx] handleStreamChunk: Detected <APPEND/> tag. Entering append mode.')
          appendMode.current = true
          resetIsPending.current = false
          const contentAfterTag = buf.replace('<APPEND/>', '')
          if (contentAfterTag) {
            console.log('[AI.tsx] handleStreamChunk: Appending content after <APPEND/> tag:', contentAfterTag)
            addContent(contentAfterTag)
          }
          return
        }

        // Any other content means a brand-new answer.
        console.log('[AI.tsx] handleStreamChunk: No special tag detected. Starting new answer with:', buf)
        appendMode.current = false
        skipResponse.current = false
        resetIsPending.current = false
        setAnswer('') // Clear previous answer
        addContent(buf)
        return
      }

      // 3. Subsequent chunks within the same turn
      if (skipResponse.current) return // Ignoring this turn

      addContent(chunk.text)
    }

    const handleApiError = (error: string) => setErrorMessage(error)
    const handleSetInitialInput = (value: string) => setInputValue(value)

    // Expose focus and send helpers for global shortcuts
    ;(window as any).chatInputAPI = {
      focus: () => {
        inputRef.current?.focus()
      },
      submit: handleSubmit,
    }

    window.api.receive('api-stream-chunk', handleStreamChunk as any)
    window.api.receive('gemini-transcript', handleStreamChunk as any)
    window.api.receive('chat:chunk', handleStreamChunk as any)
    window.api.receive('api-error', handleApiError)
    window.api.receive('set-initial-input', handleSetInitialInput)

    return () => {
      window.api.removeAllListeners('api-stream-chunk')
      delete (window as any).chatInputAPI
      window.api.removeAllListeners('gemini-transcript')
      window.api.removeAllListeners('chat:chunk')
      window.api.removeAllListeners('api-error')
      window.api.removeAllListeners('set-initial-input')
    }
  }, [send, isChatLoading, onContentChange, answer])

  useEffect(() => {
    if (isChatPaneVisible && (isChatIdle || isChatError)) {
      inputRef.current?.focus()
    }
  }, [isChatPaneVisible, isChatIdle, isChatError])

  // Reset content width when mic/live mode is turned off
  useEffect(() => {
    if (!isLiveActive) {
      onContentChange?.(false)
    }
  }, [isLiveActive, onContentChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleSubmit = () => {
    const val = inputRef.current?.value.trim() || ''

    if (isChatLoading) return

    if (val) {
      // Regular chat submission with user input
      console.log('[AI.tsx] Sending SUBMIT event to UI actor with value:', val)
      send({ type: 'SUBMIT', value: val })
      setInputValue('')
    } else {
      // Prefill with screen analysis prompt when no input
      const screenAnalysisPrompt = 'analyse the screen and provide the answer accordingly'
      console.log('[AI.tsx] Sending SUBMIT event to UI actor with screen analysis prompt')
      send({ type: 'SUBMIT', value: screenAnalysisPrompt })
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const renderChatContent = () => {
    if (isChatError) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-red-500 glass rounded-lg">
          {errorMessage || 'An error occurred.'}
        </div>
      )
    }

    if (errorMessage) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 text-red-500 glass rounded-lg">{errorMessage}</div>
      )
    }

    if (isChatLoading && !answer) {
      return <div className="flex-1 p-4 glass rounded-lg animate-pulse">Loading...</div>
    }

    if (answer) {
      return (
        <div className="flex-1 p-4 glass rounded-lg overflow-y-auto ">
          <MarkdownRenderer content={answer} />
        </div>
      )
    }

    return (
      <div className="flex-1 flex items-center justify-center p-4 glass rounded-lg text-gray-500">
        Start a conversation...
      </div>
    )
  }

  return (
    <div className="flex max-h-full w-full bg-transparent p-2 gap-3">
      {/* Left Panel - Transcript (Fixed Width) */}
      {isLiveActive && (
        <div className="w-100 flex-shrink-0 h-full">
          <TranscriptPane />
        </div>
      )}

      {/* Right Panel - Chat (Flexible Width) */}
      <div className={`flex-1 flex flex-col h-full gap-2 min-w-0 text-sm ${isLiveActive ? '' : 'h-1/4'}`}>
        {/* Chat Content - Expands to fill available space */}
        {renderChatContent()}

        {/* Input Area - Fixed Height */}
        <div className="relative max-h-10 flex-shrink-0">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isChatLoading
                ? 'Generating answer...'
                : answer
                  ? 'Ask a follow-up... (or press Enter for screen analysis)'
                  : 'Ask me anything... (or press Enter for screen analysis)'
            }
            className="glass rounded-full w-full mr-14"
            disabled={isChatLoading}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="flex gap-2 items-center">
              {isLiveActive && (
                <button
                  onClick={() => {
                    const newMuteStatus = !isGeminiMuted
                    setIsGeminiMuted(newMuteStatus)
                    window.api.send('live-audio-toggle-gemini', newMuteStatus)
                  }}
                  className="rounded-full hover:bg-gray-200/70 focus:outline-none flex items-center justify-center h-4 w-4"
                  title={isGeminiMuted ? 'Unmute Gemini Audio' : 'Mute Gemini Audio'}
                >
                  {isGeminiMuted ? <MicOff className="size-4 text-red-500" /> : <Mic className="size-4" />}
                </button>
              )}
              <Command className="size-4" />
              <CornerDownLeft className="size-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
