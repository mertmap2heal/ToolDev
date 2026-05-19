/**
 * RF-1 — primitive component library render / prop tests.
 *
 * Light component-render tests for the `components/ui/` primitives: they
 * confirm each primitive renders, honours its key props, and exposes the
 * accessibility hooks the Design comment specified (focus role, aria-selected,
 * aria-sort, aria-pressed). They are not visual-regression tests — the
 * `_chrome.css` styling fidelity is verified by the e2e chrome smoke.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Button,
  ButtonSplit,
  Tabs,
  StatusPill,
  toneForStatus,
  STATUS_TONE,
  DalChip,
  SeverityBadge,
  MonoChip,
  Avatar,
  StatTile,
  Banner,
  Card,
  CardHead,
  CardBody,
  FilterPill,
  Table,
  TableHead,
  TableBody,
  TableHeaderCell,
  TableRow,
  TableCell,
  Checkbox,
  Segmented,
} from '@/components/ui'

describe('Button', () => {
  it('renders a button with its label', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('renders type="button" by default', () => {
    render(<Button>Click</Button>)
    expect(screen.getByRole('button', { name: 'Click' })).toHaveAttribute('type', 'button')
  })

  it('fires onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the primary variant with the accent fill', () => {
    render(<Button variant="primary">Create</Button>)
    const btn = screen.getByRole('button', { name: 'Create' })
    expect(btn.style.background).toContain('--theme-accent')
    expect(btn.style.color).toBe('rgb(255, 255, 255)')
  })

  it('renders the ghost variant with a transparent border', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button', { name: 'Ghost' })
    expect(btn.style.borderColor).toBe('transparent')
  })

  it('renders the sm size at 26px height', () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button', { name: 'Small' }).style.height).toBe('26px')
  })

  it('renders the default size at 30px height', () => {
    render(<Button>Default</Button>)
    expect(screen.getByRole('button', { name: 'Default' }).style.height).toBe('30px')
  })

  it('honours the disabled prop', () => {
    render(<Button disabled>Off</Button>)
    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled()
  })

  it('renders as an anchor when as="a"', () => {
    render(
      <Button as="a" href="/foo">
        Link
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Link' })
    expect(link).toHaveAttribute('href', '/foo')
  })
})

describe('ButtonSplit', () => {
  it('renders both child buttons joined in a group', () => {
    render(
      <ButtonSplit aria-label="actions">
        <Button>Export</Button>
        <Button caret aria-label="more" />
      </ButtonSplit>,
    )
    expect(screen.getByRole('group', { name: 'actions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'more' })).toBeInTheDocument()
  })
})

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Runs', count: 3 },
    { id: 'b', label: 'Coverage' },
    { id: 'c', label: 'Settings' },
  ]

  it('renders a tablist with one tab per item', () => {
    render(<Tabs tabs={tabs} activeId="a" onSelect={() => {}} aria-label="views" />)
    expect(screen.getByRole('tablist', { name: 'views' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('marks the active tab with aria-selected', () => {
    render(<Tabs tabs={tabs} activeId="b" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: /Coverage/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Runs/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('gives only the active tab tabIndex 0 (roving tabindex)', () => {
    render(<Tabs tabs={tabs} activeId="a" onSelect={() => {}} />)
    expect(screen.getByRole('tab', { name: /Runs/ })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /Coverage/ })).toHaveAttribute('tabindex', '-1')
  })

  it('fires onSelect when a tab is clicked', () => {
    const onSelect = vi.fn()
    render(<Tabs tabs={tabs} activeId="a" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('tab', { name: /Settings/ }))
    expect(onSelect).toHaveBeenCalledWith('c')
  })

  it('moves selection with ArrowRight (arrow-key roving)', () => {
    const onSelect = vi.fn()
    render(<Tabs tabs={tabs} activeId="a" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: /Runs/ }), { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('wraps with ArrowLeft from the first tab', () => {
    const onSelect = vi.fn()
    render(<Tabs tabs={tabs} activeId="a" onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: /Runs/ }), { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith('c')
  })

  it('renders the count badge', () => {
    render(<Tabs tabs={tabs} activeId="a" onSelect={() => {}} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('StatusPill / STATUS_TONE', () => {
  it('renders the status label', () => {
    render(<StatusPill status="Released" />)
    expect(screen.getByText('Released')).toBeInTheDocument()
  })

  it('maps the 5 vocabulary groups to the correct tone', () => {
    expect(toneForStatus('released')).toBe('success')
    expect(toneForStatus('passed')).toBe('success')
    expect(toneForStatus('In Progress')).toBe('warning')
    expect(toneForStatus('review')).toBe('warning')
    expect(toneForStatus('draft')).toBe('neutral')
    expect(toneForStatus('archived')).toBe('neutral')
    expect(toneForStatus('failed')).toBe('danger')
    expect(toneForStatus('blocked')).toBe('danger')
    expect(toneForStatus('planned')).toBe('info')
    expect(toneForStatus('todo')).toBe('info')
  })

  it('falls back to neutral for an unknown status', () => {
    expect(toneForStatus('frobnicated')).toBe('neutral')
  })

  it('STATUS_TONE is a shared lookup keyed lower-case', () => {
    expect(STATUS_TONE['verified']).toBe('success')
    expect(STATUS_TONE['deprecated']).toBe('danger')
  })

  it('honours an explicit tone override', () => {
    render(<StatusPill status="anything" tone="danger" label="Custom" />)
    const pill = screen.getByText('Custom')
    expect(pill.style.color).toContain('--status-danger')
  })

  it('renders a custom label when provided', () => {
    render(<StatusPill status="passed" label="All checks green" />)
    expect(screen.getByText('All checks green')).toBeInTheDocument()
  })
})

describe('DalChip', () => {
  it.each(['A', 'B', 'C', 'D', 'E'] as const)('renders DAL %s', (dal) => {
    render(<DalChip dal={dal} />)
    expect(screen.getByText(dal)).toBeInTheDocument()
    expect(screen.getByTitle(`DAL ${dal}`)).toBeInTheDocument()
  })
})

describe('SeverityBadge', () => {
  it('renders the human label for each severity', () => {
    render(<SeverityBadge severity="catastrophic" />)
    expect(screen.getByText('Catastrophic')).toBeInTheDocument()
  })

  it('renders the no-safety-effect label for "none"', () => {
    render(<SeverityBadge severity="none" />)
    expect(screen.getByText('No Safety Effect')).toBeInTheDocument()
  })

  it('honours a label override', () => {
    render(<SeverityBadge severity="major" label="MAJ" />)
    expect(screen.getByText('MAJ')).toBeInTheDocument()
  })
})

describe('MonoChip', () => {
  it('renders its content', () => {
    render(<MonoChip>REQ-1024</MonoChip>)
    expect(screen.getByText('REQ-1024')).toBeInTheDocument()
  })

  it('applies a tint', () => {
    render(<MonoChip tint="green">PASS</MonoChip>)
    const chip = screen.getByText('PASS')
    expect(chip.style.background).toContain('--theme-success-tint')
  })
})

describe('Avatar', () => {
  it('derives 2-letter initials from a full name', () => {
    render(<Avatar name="Ada Lovelace" />)
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('honours explicit initials', () => {
    render(<Avatar initials="QA" />)
    expect(screen.getByText('QA')).toBeInTheDocument()
  })

  it('is colour-stable — the same name yields the same tint', () => {
    const { container: a } = render(<Avatar name="Grace Hopper" />)
    const { container: b } = render(<Avatar name="Grace Hopper" />)
    const bgA = (a.firstChild as HTMLElement).style.background
    const bgB = (b.firstChild as HTMLElement).style.background
    expect(bgA).toBe(bgB)
  })
})

describe('StatTile', () => {
  it('renders label and value', () => {
    render(<StatTile label="Requirements" value={128} />)
    expect(screen.getByText('Requirements')).toBeInTheDocument()
    expect(screen.getByText('128')).toBeInTheDocument()
  })

  it('renders an em-dash for an empty value', () => {
    render(<StatTile label="Coverage" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders an up delta with the success tone', () => {
    render(<StatTile label="Velocity" value={42} delta={{ value: '+5', direction: 'up' }} />)
    const delta = screen.getByText('+5')
    expect(delta.style.color).toContain('--theme-teal')
  })

  it('renders a down delta with the danger tone', () => {
    render(<StatTile label="Open" value={3} delta={{ value: '-2', direction: 'down' }} />)
    const delta = screen.getByText('-2')
    expect(delta.style.color).toContain('--status-danger')
  })
})

describe('Banner', () => {
  it('renders children and defaults to the warning variant', () => {
    render(<Banner>Strict mode active</Banner>)
    expect(screen.getByText('Strict mode active')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders a badge and actions', () => {
    render(
      <Banner variant="info" badge="INFO" actions={<button>Dismiss</button>}>
        A notice
      </Banner>,
    )
    expect(screen.getByText('INFO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('composes head + body', () => {
    render(
      <Card>
        <CardHead title="Coverage" meta="updated 2h ago" />
        <CardBody>body content</CardBody>
      </Card>,
    )
    expect(screen.getByRole('heading', { name: 'Coverage' })).toBeInTheDocument()
    expect(screen.getByText('updated 2h ago')).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('paints on the surface tone when surface', () => {
    const { container } = render(<Card surface>x</Card>)
    expect((container.firstChild as HTMLElement).style.background).toContain('--theme-surface')
  })
})

describe('FilterPill', () => {
  it('renders the default form as a button', () => {
    render(<FilterPill>Add filter</FilterPill>)
    expect(screen.getByRole('button', { name: 'Add filter' })).toBeInTheDocument()
  })

  it('renders the compact form with key + value and a labelled remove button', () => {
    const onRemove = vi.fn()
    render(<FilterPill compact filterKey="Status" value="Open" onRemove={onRemove} />)
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    const remove = screen.getByRole('button', { name: /Remove Status filter/ })
    fireEvent.click(remove)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('renders the clear-all form', () => {
    const onClick = vi.fn()
    render(<FilterPill clearAll onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'Clear all' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Table primitives', () => {
  it('renders a sortable header cell with aria-sort', () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell sortable sortDirection="asc">
              Title
            </TableHeaderCell>
            <TableHeaderCell>Owner</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>REQ-1</TableCell>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const sorted = screen.getByRole('columnheader', { name: /Title/ })
    expect(sorted).toHaveAttribute('aria-sort', 'ascending')
    // a non-sortable header carries no aria-sort
    expect(screen.getByRole('columnheader', { name: 'Owner' })).not.toHaveAttribute('aria-sort')
  })

  it('fires onSort when a sortable header is activated', () => {
    const onSort = vi.fn()
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell sortable onSort={onSort}>
              Date
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody />
      </Table>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Date/ }))
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('marks a selected row with aria-selected', () => {
    render(
      <Table>
        <TableBody>
          <TableRow selected>
            <TableCell selected>picked</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Checkbox', () => {
  it('renders an unchecked checkbox by default', () => {
    render(<Checkbox aria-label="select row" />)
    const cb = screen.getByRole('checkbox', { name: 'select row' })
    expect(cb).not.toBeChecked()
  })

  it('toggles on click (uncontrolled)', () => {
    render(<Checkbox aria-label="pick" />)
    const cb = screen.getByRole('checkbox', { name: 'pick' })
    fireEvent.click(cb)
    expect(cb).toBeChecked()
  })

  it('reflects the controlled checked prop', () => {
    render(<Checkbox aria-label="ctrl" checked readOnly />)
    expect(screen.getByRole('checkbox', { name: 'ctrl' })).toBeChecked()
  })

  it('fires onChange', () => {
    const onChange = vi.fn()
    render(<Checkbox aria-label="c" onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'c' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('Segmented', () => {
  const options = [
    { id: 'list', label: 'List' },
    { id: 'grid', label: 'Grid' },
  ]

  it('renders each option and exposes aria-pressed', () => {
    render(<Segmented options={options} value="list" onChange={() => {}} aria-label="view" />)
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onChange when an option is clicked', () => {
    const onChange = vi.fn()
    render(<Segmented options={options} value="list" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(onChange).toHaveBeenCalledWith('grid')
  })
})
