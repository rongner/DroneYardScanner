import { render, screen, fireEvent } from '@testing-library/react'
import { ScanPhoto } from './ScanPhoto'

test('renders img with correct src and alt', () => {
  render(<ScanPhoto src="/api/scans/1/photo" alt="Rose Bush" />)
  const img = screen.getByRole('img')
  expect(img).toHaveAttribute('src', '/api/scans/1/photo')
  expect(img).toHaveAttribute('alt', 'Rose Bush')
})

test('uses default alt when not provided', () => {
  render(<ScanPhoto src="/api/scans/1/photo" />)
  expect(screen.getByRole('img')).toHaveAttribute('alt', 'Plant photo')
})

test('shows placeholder on image error', () => {
  render(<ScanPhoto src="/api/scans/1/photo" />)
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByText('No photo')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
