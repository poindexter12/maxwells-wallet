import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagsTab } from './TagsTab'
import { TagWithUsage, TagTabConfig } from '@/types/admin'

const mockBucketsTab: TagTabConfig = {
  id: 'buckets',
  namespace: 'bucket',
  label: 'Buckets',
  description: 'Spending categories like groceries, dining, entertainment',
  showNamespace: false
}

const mockAllTagsTab: TagTabConfig = {
  id: 'all-tags',
  namespace: null,
  label: 'All Tags',
  description: 'View all tags across all namespaces',
  showNamespace: true
}

const mockTags: TagWithUsage[] = [
  {
    id: 1,
    namespace: 'bucket',
    value: 'groceries',
    description: 'Food and household items',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    usage_count: 45
  },
  {
    id: 2,
    namespace: 'bucket',
    value: 'dining',
    description: null,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    usage_count: 0
  },
  {
    id: 3,
    namespace: 'account',
    value: 'chase-checking',
    description: 'Primary checking account',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    usage_count: 1
  }
]

describe('TagsTab', () => {
  const defaultProps = {
    currentTagTab: mockBucketsTab,
    tags: mockTags,
    tagsLoading: false,
    onAddTag: vi.fn(),
    onEditTag: vi.fn(),
    onDeleteTag: vi.fn()
  }

  it('renders tab description', () => {
    render(<TagsTab {...defaultProps} />)

    expect(screen.getByText('Spending categories like groceries, dining, entertainment')).toBeInTheDocument()
  })

  it('shows Add button when namespace is defined', () => {
    render(<TagsTab {...defaultProps} />)

    expect(screen.getByText('Add Bucket')).toBeInTheDocument()
  })

  it('hides Add button when namespace is null', () => {
    render(<TagsTab {...defaultProps} currentTagTab={mockAllTagsTab} />)

    expect(screen.queryByText(/Add/)).not.toBeInTheDocument()
  })

  it('calls onAddTag when Add button clicked', () => {
    const onAddTag = vi.fn()
    render(<TagsTab {...defaultProps} onAddTag={onAddTag} />)

    fireEvent.click(screen.getByText('Add Bucket'))
    expect(onAddTag).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<TagsTab {...defaultProps} tagsLoading={true} />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no tags', () => {
    render(<TagsTab {...defaultProps} tags={[]} />)

    expect(screen.getByText('No buckets configured yet.')).toBeInTheDocument()
  })

  it('renders tag table with data', () => {
    render(<TagsTab {...defaultProps} />)

    expect(screen.getByText('groceries')).toBeInTheDocument()
    expect(screen.getByText('Food and household items')).toBeInTheDocument()
    expect(screen.getByText('dining')).toBeInTheDocument()
  })

  it('shows namespace column when showNamespace is true', () => {
    render(<TagsTab {...defaultProps} currentTagTab={mockAllTagsTab} />)

    expect(screen.getByText('Namespace')).toBeInTheDocument()
    // Multiple tags have 'bucket' namespace, so use getAllByText
    const bucketCells = screen.getAllByText('bucket')
    expect(bucketCells.length).toBeGreaterThan(0)
    expect(screen.getByText('account')).toBeInTheDocument()
  })

  it('hides namespace column when showNamespace is false', () => {
    render(<TagsTab {...defaultProps} />)

    expect(screen.queryByText('Namespace')).not.toBeInTheDocument()
  })

  it('shows "Not set" for empty description', () => {
    render(<TagsTab {...defaultProps} />)

    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('displays usage count with correct pluralization', () => {
    render(<TagsTab {...defaultProps} />)

    expect(screen.getByText('45 transactions')).toBeInTheDocument()
    expect(screen.getByText('0 transactions')).toBeInTheDocument()
    expect(screen.getByText('1 transaction')).toBeInTheDocument()
  })

  it('calls onEditTag when Edit clicked', () => {
    const onEditTag = vi.fn()
    render(<TagsTab {...defaultProps} onEditTag={onEditTag} />)

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])
    expect(onEditTag).toHaveBeenCalledWith(mockTags[0])
  })

  it('calls onDeleteTag when Delete clicked', () => {
    const onDeleteTag = vi.fn()
    render(<TagsTab {...defaultProps} onDeleteTag={onDeleteTag} />)

    const deleteButtons = screen.getAllByText('Delete')
    // Click on the second delete button (usage_count: 0)
    fireEvent.click(deleteButtons[1])
    expect(onDeleteTag).toHaveBeenCalledWith(mockTags[1])
  })

  it('disables delete for tags with usage_count > 0', () => {
    render(<TagsTab {...defaultProps} />)

    const deleteButtons = screen.getAllByText('Delete')
    // First tag has usage_count: 45
    expect(deleteButtons[0]).toBeDisabled()
    // Second tag has usage_count: 0
    expect(deleteButtons[1]).not.toBeDisabled()
    // Third tag has usage_count: 1
    expect(deleteButtons[2]).toBeDisabled()
  })

  it('shows tooltip on disabled delete button', () => {
    render(<TagsTab {...defaultProps} />)

    const deleteButtons = screen.getAllByText('Delete')
    expect(deleteButtons[0]).toHaveAttribute('title', 'Cannot delete: tag is in use')
    expect(deleteButtons[1]).toHaveAttribute('title', 'Delete tag')
  })
})
