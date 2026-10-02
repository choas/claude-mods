export type GitStatusLabel = string | null

declare module 'claude-code' {
  interface PluginState {
    'git-status': { label: GitStatusLabel }
  }
}
