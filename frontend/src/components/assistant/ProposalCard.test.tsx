import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProposalCard } from './ProposalCard'
import { TEST_IDS } from '@/test-ids'
import type { Proposal } from '@/lib/assistant'

const executeProposal = vi.fn()
vi.mock('@/lib/assistant', () => ({
  executeProposal: (...args: unknown[]) => executeProposal(...args),
}))

const proposal: Proposal = {
  id: 'p1',
  actions: [
    { index: 0, tool: 'create_budget', summary: 'Create a monthly budget of $200.00 for bucket:dining' },
    { index: 1, tool: 'create_dashboard', summary: 'Create dashboard “Dining”' },
  ],
}

describe('ProposalCard', () => {
  beforeEach(() => {
    executeProposal.mockReset()
  })

  it('lists each proposed action', () => {
    render(<ProposalCard proposal={proposal} onDone={vi.fn()} onDismiss={vi.fn()} />)
    const actions = screen.getAllByTestId(TEST_IDS.ASSISTANT_PROPOSAL_ACTION)
    expect(actions).toHaveLength(2)
    expect(screen.getByText(/monthly budget of \$200\.00/)).toBeInTheDocument()
  })

  it('executes the proposal on Execute and reports completion', async () => {
    executeProposal.mockResolvedValue({ executed: [{ index: 0 }, { index: 1 }] })
    const onDone = vi.fn()
    render(<ProposalCard proposal={proposal} onDone={onDone} onDismiss={vi.fn()} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.ASSISTANT_PROPOSAL_EXECUTE))

    await waitFor(() => expect(executeProposal).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(2))
  })

  it('NEVER executes when dismissed — only calls onDismiss', () => {
    const onDismiss = vi.fn()
    render(<ProposalCard proposal={proposal} onDone={vi.fn()} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.ASSISTANT_PROPOSAL_CANCEL))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(executeProposal).not.toHaveBeenCalled()
  })
})
