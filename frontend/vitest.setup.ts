import '@testing-library/jest-dom/vitest'

// JSDOM does not implement ResizeObserver / matchMedia, but a number of
// upstream packages (reactflow, floating-ui, headless table libs) call them
// at mount. Provide minimal no-op shims so component tests that incidentally
// pull these packages do not error before the assertion runs.
class ResizeObserverShim {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-expect-error -- shim is sufficient for test env
  globalThis.ResizeObserver = ResizeObserverShim
}

if (typeof globalThis.matchMedia === 'undefined') {
  // @ts-expect-error -- minimal shim, returns a fixed-shape MediaQueryList
  globalThis.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
