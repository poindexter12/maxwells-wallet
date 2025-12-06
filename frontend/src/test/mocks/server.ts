import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup MSW server for Node.js (Vitest runs in Node)
export const server = setupServer(...handlers)
