'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TEST_IDS } from '@/test-ids'
import { AssistantSettings } from '@/components/assistant/AssistantSettings'
import { ProposalCard } from '@/components/assistant/ProposalCard'
import {
  getAssistantConfig,
  sendChat,
  type AssistantConfig,
  type Proposal,
} from '@/lib/assistant'

interface Message {
  role: 'user' | 'assistant'
  text: string
  proposal?: Proposal | null
}

export default function AssistantPage() {
  const t = useTranslations('assistant')
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getAssistantConfig()
      .then((c) => {
        setConfig(c)
        setShowSettings(!c.configured)
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    setError(null)
    setMessages((m) => [...m, { role: 'user', text: message }])
    setSending(true)
    try {
      const res = await sendChat(message, conversationId)
      setConversationId(res.conversation_id)
      setMessages((m) => [...m, { role: 'assistant', text: res.reply, proposal: res.proposal }])
    } catch (e) {
      const err = e as Error & { code?: string }
      if (err.code === 'ASSISTANT_NOT_CONFIGURED') setShowSettings(true)
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  function dismissProposal(index: number) {
    setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, proposal: null } : msg)))
  }

  return (
    <div data-testid={TEST_IDS.ASSISTANT_PAGE} className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          data-testid={TEST_IDS.ASSISTANT_SETTINGS_TOGGLE}
          data-chaos-target="assistant-settings-toggle"
          onClick={() => setShowSettings((s) => !s)}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('settings.title')}
        </button>
      </header>

      {showSettings && config && <AssistantSettings config={config} />}

      {config && !config.configured && !showSettings && (
        <p data-testid={TEST_IDS.ASSISTANT_NOT_CONFIGURED} className="text-sm text-amber-700 dark:text-amber-400">
          {t('settings.notConfigured')}
        </p>
      )}

      <div
        data-testid={TEST_IDS.ASSISTANT_MESSAGES}
        className="flex min-h-[320px] flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
      >
        {messages.length === 0 ? (
          <p className="m-auto max-w-md text-center text-sm text-gray-500 dark:text-gray-400">{t('emptyState')}</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} data-testid={TEST_IDS.ASSISTANT_MESSAGE} data-role={msg.role}>
              <div
                className={
                  msg.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white'
                    : 'mr-auto max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                }
              >
                <span className="mb-0.5 block text-xs font-medium opacity-70">
                  {msg.role === 'user' ? t('youLabel') : t('assistantLabel')}
                </span>
                <span className="whitespace-pre-wrap">{msg.text}</span>
              </div>
              {msg.proposal && (
                <ProposalCard
                  proposal={msg.proposal}
                  onDone={() => dismissProposal(i)}
                  onDismiss={() => dismissProposal(i)}
                />
              )}
            </div>
          ))
        )}
        {sending && <p className="text-sm text-gray-500 dark:text-gray-400">{t('thinking')}</p>}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <input
          data-testid={TEST_IDS.ASSISTANT_INPUT}
          data-chaos-target="assistant-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={t('placeholder')}
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
        <button
          type="button"
          data-testid={TEST_IDS.ASSISTANT_SEND}
          data-chaos-target="assistant-send"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {t('send')}
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">{t('privacyNote')}</p>
    </div>
  )
}
