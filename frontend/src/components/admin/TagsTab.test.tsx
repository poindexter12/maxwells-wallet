import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TagsTab } from './TagsTab'
import { TagWithUsage, TagTabConfig } from '@/types/admin'
import { TEST_IDS } from '@/test-ids'

const mockBucketsTab: TagTabConfig = {
  id: 'buckets',
  namespace: 'bucket',
  labelKey: 'bucketsLabel',
  descriptionKey: 'bucketsDescription',
  showNamespace: false
}

const mockAllTagsTab: TagTabConfig = {
  id: 'all-tags',
  namespace: null,
  labelKey: 'allTagsLabel',
  descriptionKey: 'allTagsDescription',
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

    // Translation returns the key when not mocked - just verify the element is rendered
    expect(screen.getByTestId(TEST_IDS.TAGS_TAB_DESCRIPTION)).toBeInTheDocument()
  })

  it('shows Add button when namespace is defined', () => {
    render(<TagsTab {...defaultProps} />)

    expect(screen.getByTestId(TEST_IDS.TAGS_TAB_ADD_BUTTON)).toBeInTheDocument()
  })

  it('hides Add button when namespace is null', () => {
    render(<TagsTab {...defaultProps} currentTagTab={mockAllTagsTab} />)

    expect(screen.queryByTestId(TEST_IDS.TAGS_TAB_ADD_BUTTON)).not.toBeInTheDocument()
  })

  it('calls onAddTag when Add button clicked', () => {
    const onAddTag = vi.fn()
    render(<TagsTab {...defaultProps} onAddTag={onAddTag} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.TAGS_TAB_ADD_BUTTON))
    expect(onAddTag).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<TagsTab {...defaultProps} tagsLoading={true} />)

    expect(screen.getByTestId(TEST_IDS.TAGS_TAB_LOADING)).toBeInTheDocument()
  })

  it('shows empty state when no tags', () => {
    render(<TagsTab {...defaultProps} tags={[]} />)

    expect(screen.getByTestId(TEST_IDS.TAGS_TAB_EMPTY)).toBeInTheDocument()
  })

  it('renders tag table with data', () => {
    render(<TagsTab {...defaultProps} />)

    const table = screen.getByTestId(TEST_IDS.TAGS_TAB_TABLE)
    expect(table).toBeInTheDocument()
    expect(table).toHaveTextContent('groceries')
    expect(table).toHaveTextContent('Food and household items')
    expect(table).toHaveTextContent('dining')
  })

  it('shows namespace column when showNamespace is true', () => {
    render(<TagsTab {...defaultProps} currentTagTab={mockAllTagsTab} />)

    const table = screen.getByTestId(TEST_IDS.TAGS_TAB_TABLE)
    expect(table).toHaveTextContent('bucket')
    expect(table).toHaveTextContent('account')
  })

  it('displays usage count', () => {
    render(<TagsTab {...defaultProps} />)

    const table = screen.getByTestId(TEST_IDS.TAGS_TAB_TABLE)
    expect(table).toHaveTextContent('45')
    expect(table).toHaveTextContent('0')
    expect(table).toHaveTextContent('1')
  })

  it('disables delete for tags with usage_count > 0', () => {
    render(<TagsTab {...defaultProps} />)

    const table = screen.getByTestId(TEST_IDS.TAGS_TAB_TABLE)
    const deleteButtons = table.querySelectorAll('button.text-negative')

    // First tag has usage_count: 45 - should be disabled
    expect(deleteButtons[0]).toBeDisabled()
    // Second tag has usage_count: 0 - should be enabled
    expect(deleteButtons[1]).not.toBeDisabled()
    // Third tag has usage_count: 1 - should be disabled
    expect(deleteButtons[2]).toBeDisabled()
  })
})
