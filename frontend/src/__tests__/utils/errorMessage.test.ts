import { describe, it, expect } from 'vitest'
import { errorMessage, errorStatusCode } from '@/utils/errorMessage'

describe('errorMessage', () => {
  it('returns default fallback for null and undefined', () => {
    expect(errorMessage(null)).toBe('Something went wrong')
    expect(errorMessage(undefined)).toBe('Something went wrong')
  })

  it('uses the supplied fallback when input is null/undefined', () => {
    expect(errorMessage(null, 'Boom!')).toBe('Boom!')
    expect(errorMessage(undefined, 'Boom!')).toBe('Boom!')
  })

  it('returns string input verbatim', () => {
    expect(errorMessage('plain message')).toBe('plain message')
    expect(errorMessage('')).toBe('') // empty string short-circuits before fallback
  })

  it('returns Error.message for Error instances', () => {
    expect(errorMessage(new Error('oops'))).toBe('oops')
    expect(errorMessage(new TypeError('bad type'))).toBe('bad type')
  })

  it('falls back when Error.message is empty', () => {
    expect(errorMessage(new Error(''))).toBe('Something went wrong')
    expect(errorMessage(new Error(''), 'custom')).toBe('custom')
  })

  it('prefers ApiResponse.error over .message', () => {
    expect(
      errorMessage({ error: 'api error string', message: 'lower priority' })
    ).toBe('api error string')
  })

  it('uses .message when .error is missing', () => {
    expect(errorMessage({ message: 'just a message' })).toBe('just a message')
  })

  it('falls back when both .error and .message are empty strings', () => {
    expect(errorMessage({ error: '', message: '' })).toBe('Something went wrong')
  })

  it('falls back for objects without .error or .message', () => {
    expect(errorMessage({ foo: 'bar' })).toBe('Something went wrong')
    expect(errorMessage({})).toBe('Something went wrong')
  })

  it('ignores non-string .error / .message values', () => {
    expect(errorMessage({ error: 123, message: 'fallback msg' })).toBe('fallback msg')
    expect(errorMessage({ error: 123 })).toBe('Something went wrong')
  })
})

describe('errorStatusCode', () => {
  it('returns numeric statusCode from object', () => {
    expect(errorStatusCode({ statusCode: 404 })).toBe(404)
    expect(errorStatusCode({ statusCode: 500, error: 'x' })).toBe(500)
  })

  it('returns undefined when statusCode missing', () => {
    expect(errorStatusCode({})).toBeUndefined()
    expect(errorStatusCode({ error: 'x' })).toBeUndefined()
  })

  it('returns undefined for non-objects', () => {
    expect(errorStatusCode(null)).toBeUndefined()
    expect(errorStatusCode(undefined)).toBeUndefined()
    expect(errorStatusCode('string')).toBeUndefined()
    expect(errorStatusCode(404)).toBeUndefined()
  })

  it('returns undefined for non-numeric statusCode', () => {
    expect(errorStatusCode({ statusCode: '404' })).toBeUndefined()
    expect(errorStatusCode({ statusCode: null })).toBeUndefined()
  })
})
