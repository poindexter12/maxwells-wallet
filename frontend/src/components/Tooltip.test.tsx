import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tooltip, HelpTip } from './Tooltip'

describe('Tooltip', () => {
  it('renders default help icon when no children provided', () => {
    render(<Tooltip content="Help text" />)
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument()
  })

  it('renders custom children when provided', () => {
    render(
      <Tooltip content="Help text">
        <span data-testid="custom-trigger">Custom trigger</span>
      </Tooltip>
    )
    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Help' })).not.toBeInTheDocument()
  })

  it('shows tooltip on mouse enter', () => {
    render(<Tooltip content="Help text content" />)

    const trigger = screen.getByRole('button', { name: 'Help' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.mouseEnter(trigger.parentElement!)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText('Help text content')).toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', () => {
    render(<Tooltip content="Help text" />)

    const trigger = screen.getByRole('button', { name: 'Help' })
    fireEvent.mouseEnter(trigger.parentElement!)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.mouseLeave(trigger.parentElement!)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip on focus', () => {
    render(<Tooltip content="Focus help" />)

    const trigger = screen.getByRole('button', { name: 'Help' })
    fireEvent.focus(trigger.parentElement!)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('hides tooltip on blur', () => {
    render(<Tooltip content="Focus help" />)

    const trigger = screen.getByRole('button', { name: 'Help' })
    fireEvent.focus(trigger.parentElement!)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.blur(trigger.parentElement!)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('renders ReactNode content', () => {
    render(
      <Tooltip content={<div data-testid="rich-content">Rich <strong>content</strong></div>} />
    )

    const trigger = screen.getByRole('button', { name: 'Help' })
    fireEvent.mouseEnter(trigger.parentElement!)
    expect(screen.getByTestId('rich-content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Tooltip content="Help" className="custom-class" />)
    const wrapper = screen.getByRole('button', { name: 'Help' }).parentElement
    expect(wrapper).toHaveClass('custom-class')
  })
})

describe('HelpTip', () => {
  it('renders tooltip with default help icon', () => {
    render(<HelpTip content="Help tip content" />)
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument()
  })

  it('shows content on hover', () => {
    render(<HelpTip content="Help tip content" />)

    const trigger = screen.getByRole('button', { name: 'Help' })
    fireEvent.mouseEnter(trigger.parentElement!)
    expect(screen.getByText('Help tip content')).toBeInTheDocument()
  })
})
