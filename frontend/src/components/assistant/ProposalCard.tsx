'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TEST_IDS } from '@/test-ids'
import { executeProposal, type Proposal } from '@/lib/assistant'

interface ProposalCardProps {
  proposal: Proposal
  onDone: (count: number) => void
  onDismiss: () => void
}

/**
 * Renders the assistant's proposed write actions. Nothing is applied until the
 * user clicks Execute — the agent never runs writes on its own.
 */
export function ProposalCard({ proposal, onDone, onDismiss }: ProposalCardProps) {
  const t = useTranslations('assistant.proposal')
  const [status, setStatus] = useState<'idle' | 'executing' | 'done' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleExecute() {
    setStatus('executing')
    setError(null)
    try {
      const res = await executeProposal(proposal.id)
      setStatus('done')
      onDone(res.executed.length)
    } catch (e) {
      setStatus('failed')
      setError((e as Error).message)
    }
  }

  return (
    <div
      data-testid={TEST_IDS.ASSISTANT_PROPOSAL}
      className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-900/20"
    >
      <h4 className="font-semibold text-amber-900 dark:text-amber-200">{t('title')}</h4>
      <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/70">{t('description')}</p>

      <ul className="mt-3 space-y-1">
        {proposal.actions.map((a) => (
          <li
            key={a.index}
            data-testid={TEST_IDS.ASSISTANT_PROPOSAL_ACTION}
            className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-100"
          >
            <span aria-hidden className="mt-0.5">•</span>
            <span>{a.summary}</span>
          </li>
        ))}
      </ul>

      {status === 'done' ? (
        <p className="mt-3 text-sm font-medium text-green-700 dark:text-green-400">
          {t('done', { count: proposal.actions.length })}
        </p>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            data-testid={TEST_IDS.ASSISTANT_PROPOSAL_EXECUTE}
            data-chaos-exclude
            onClick={handleExecute}
            disabled={status === 'executing'}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {status === 'executing' ? t('executing') : t('execute')}
          </button>
          <button
            type="button"
            data-testid={TEST_IDS.ASSISTANT_PROPOSAL_CANCEL}
            onClick={onDismiss}
            disabled={status === 'executing'}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {status === 'failed' && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {t('failed')} {error}
        </p>
      )}
    </div>
  )
}
