import { describe, it, expect } from 'vitest'
import { htmlToPlainText, truncatePlainText } from './htmlToPlainText'

describe('htmlToPlainText', () => {
  it('strips paragraph tags', () => {
    expect(htmlToPlainText('<p>Testing Description</p>')).toBe('Testing Description')
  })

  it('handles empty and null', () => {
    expect(htmlToPlainText('')).toBe('')
    expect(htmlToPlainText(null)).toBe('')
    expect(htmlToPlainText(undefined)).toBe('')
  })

  it('truncates plain text', () => {
    expect(truncatePlainText('hello world', 5)).toBe('hello…')
  })
})
