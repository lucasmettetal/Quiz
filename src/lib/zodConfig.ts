import { z } from 'zod'

// The Content-Security-Policy forbids eval: tell zod not to probe for it
// (its JIT fast path would be refused anyway, and the probe logs a CSP issue).
z.config({ jitless: true })
