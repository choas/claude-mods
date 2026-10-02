export type CwdStatusDir = string | null

declare module 'claude-code' {
  interface PluginState {
    'cwd-status': { cwd: CwdStatusDir }
  }
}
