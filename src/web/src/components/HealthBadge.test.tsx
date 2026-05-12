import { render, screen } from '@testing-library/react'
import { HealthBadge } from './HealthBadge'

test('renders null when status is null', () => {
  const { container } = render(<HealthBadge status={null} />)
  expect(container).toBeEmptyDOMElement()
})

test('renders fallback text when status is null and fallback provided', () => {
  render(<HealthBadge status={null} fallback="No data" />)
  expect(screen.getByText('No data')).toBeInTheDocument()
})

test('capitalises healthy status', () => {
  render(<HealthBadge status="healthy" />)
  expect(screen.getByText('Healthy')).toBeInTheDocument()
})

test('capitalises unhealthy status', () => {
  render(<HealthBadge status="unhealthy" />)
  expect(screen.getByText('Unhealthy')).toBeInTheDocument()
})

test('applies green style for healthy', () => {
  render(<HealthBadge status="healthy" />)
  expect(screen.getByText('Healthy')).toHaveClass('bg-emerald-900')
})

test('applies red style for unhealthy', () => {
  render(<HealthBadge status="unhealthy" />)
  expect(screen.getByText('Unhealthy')).toHaveClass('bg-red-900')
})

test('applies red style for unknown', () => {
  render(<HealthBadge status="unknown" />)
  expect(screen.getByText('Unknown')).toHaveClass('bg-red-900')
})
