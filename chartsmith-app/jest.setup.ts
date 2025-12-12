/**
 * Jest setup file for test configuration
 */

// Polyfill ReadableStream for jsdom environment
if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor() {}
    getReader() {
      return {
        read: () => Promise.resolve({ done: true, value: undefined }),
        cancel: () => Promise.resolve(),
      };
    }
  } as any;
}

// Mock Jotai for tests that don't need full atom functionality
jest.mock('jotai', () => {
  const actualJotai = jest.requireActual('jotai');
  return {
    ...actualJotai,
    useAtom: jest.fn(),
  };
});
