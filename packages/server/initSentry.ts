import * as Integrations from '@sentry/integrations'
import * as Sentry from '@sentry/node'
// Importing @sentry/tracing patches the global hub for tracing to work.
import '@sentry/tracing'

declare global {
  namespace NodeJS {
    interface Global {
      __rootdir__: string
    }
  }
}

const APP_VERSION = process.env.npm_package_version
Sentry.init({
  environment: 'server',
  dsn: process.env.SENTRY_DSN,
  release: APP_VERSION,
  ignoreErrors: [
    '429 Too Many Requests',
    /language \S+ is not supported/,
    'Not invited to the meeting. Cannot subscribe'
  ],
  integrations: [
    new Integrations.RewriteFrames({
      root: (global as any).__rootdir__
    })
  ],
  tracesSampleRate: 1.0
})
