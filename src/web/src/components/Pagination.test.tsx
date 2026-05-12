import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination, paginate } from './Pagination'

test('renders nothing when totalPages <= 1', () => {
  const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})

test('shows current page and total', () => {
  render(<Pagination page={2} totalPages={5} onChange={() => {}} />)
  expect(screen.getByText('2 / 5')).toBeInTheDocument()
})

test('prev button disabled on first page', () => {
  render(<Pagination page={1} totalPages={3} onChange={() => {}} />)
  const [prev] = screen.getAllByRole('button')
  expect(prev).toBeDisabled()
})

test('next button disabled on last page', () => {
  render(<Pagination page={3} totalPages={3} onChange={() => {}} />)
  const buttons = screen.getAllByRole('button')
  expect(buttons[buttons.length - 1]).toBeDisabled()
})

test('calls onChange with decremented page on prev click', async () => {
  const onChange = vi.fn()
  render(<Pagination page={3} totalPages={5} onChange={onChange} />)
  await userEvent.click(screen.getAllByRole('button')[0])
  expect(onChange).toHaveBeenCalledWith(2)
})

test('calls onChange with incremented page on next click', async () => {
  const onChange = vi.fn()
  render(<Pagination page={3} totalPages={5} onChange={onChange} />)
  const buttons = screen.getAllByRole('button')
  await userEvent.click(buttons[buttons.length - 1])
  expect(onChange).toHaveBeenCalledWith(4)
})

test('paginate slices correctly', () => {
  const items = [1, 2, 3, 4, 5, 6, 7]
  expect(paginate(items, 1, 3)).toEqual([1, 2, 3])
  expect(paginate(items, 2, 3)).toEqual([4, 5, 6])
  expect(paginate(items, 3, 3)).toEqual([7])
})
