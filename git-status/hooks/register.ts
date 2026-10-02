import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const label = atom({ plugin: 'git-status', key: 'label' } as const, null)

export type GitSummary = { branch: string; changed: number; ahead: number | undefined }

// Reads `git status --porcelain=v2 --branch`; `ahead` is undefined when there is no upstream.
export function parseStatus(out: string): GitSummary {
  let branch = '?'
  let oid = ''
  let changed = 0
  let ahead: number | undefined
  for (const line of out.split('\n')) {
    if (line.startsWith('# branch.oid ')) oid = line.slice(13)
    else if (line.startsWith('# branch.head ')) branch = line.slice(14)
    else if (line.startsWith('# branch.ab ')) ahead = Number(line.match(/\+(\d+)/)?.[1] ?? 0)
    else if (/^[12u?] /.test(line)) changed++
  }
  if (branch === '(detached)') branch = oid.slice(0, 7) || 'detached'
  return { branch, changed, ahead }
}

export function format({ branch, changed, ahead }: GitSummary): string {
  const parts = [`⎇ ${branch}`]
  if (changed) parts.push(`●${changed}`)
  if (ahead) parts.push(`↑${ahead}`)
  return parts.join(' ')
}

// Joins `path` onto `base` the way `cd` would: `~` is home, `.` and `..` fold away.
export function resolveDir(base: string, path: string, home: string | undefined): string {
  const expanded = home && (path === '~' || path.startsWith('~/')) ? home + path.slice(1) : path
  const parts: string[] = []
  for (const part of (expanded.startsWith('/') ? expanded : `${base}/${expanded}`).split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '' && part !== '.') parts.push(part)
  }
  return `/${parts.join('/')}`
}

// The folder the last top-level `cd`/`pushd` in a Bash command leaves it in, if any.
export function cdTarget(command: string, base: string, home: string | undefined): string | undefined {
  let dir: string | undefined
  for (const step of command.split(/&&|\|\||;|\n/)) {
    const m = step.trim().match(/^(?:cd|pushd)(?:\s+(?:--\s+)?("[^"]*"|'[^']*'|\S+))?\s*$/)
    if (!m) continue
    const arg = m[1]?.replace(/^(["'])(.*)\1$/, '$2')
    if (arg === '-') continue
    dir = arg === undefined ? home : resolveDir(dir ?? base, arg, home)
  }
  return dir
}

async function git($: EngineInterface, cwd: string, ...args: string[]) {
  return $.process.run(['git', ...args], { cwd, timeoutMs: 5000, env: { GIT_OPTIONAL_LOCKS: '0' } })
}

// The folder the label describes: the last Bash command's `cd` target, else the session's.
let followed: string | undefined

async function refresh($: EngineInterface) {
  let next: string | null = null
  try {
    const cwd = followed ?? (await $.session.cwd())
    const status = await git($, cwd, 'status', '--porcelain=v2', '--branch')
    if (status.exitCode === 0) {
      const summary = parseStatus(status.stdout)
      // No upstream: count the commits that are on no remote at all.
      if (summary.ahead === undefined) {
        const local = await git($, cwd, 'rev-list', '--count', 'HEAD', '--not', '--remotes')
        summary.ahead = local.exitCode === 0 ? Number(local.stdout.trim()) || 0 : 0
      }
      next = format(summary)
    }
  } catch {
    // git missing or too slow: show nothing
  }
  if ((await read($, label)) !== next) await update($, label, () => next)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // A commit made outside Claude shows up with the next prompt.
  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // A `cd` inside a Bash command moves that command only, so follow where it ran
  // and keep showing that repo until another tool or a real folder change.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const before = await $.session.cwd()
    const result = await next(e)
    const target = cdTarget(e.command, before, await $.env.get('HOME'))
    const after = await $.session.cwd()
    followed = after !== before || !target ? undefined : target
    await refresh($)
    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit') {
      followed = undefined
      await refresh($)
    }
    return result
  })

  on('classic.CwdChanged', async ($, e, next) => {
    const result = await next(e)
    followed = undefined
    await refresh($)
    return result
  })

  // Shown with the footer's mode labels, next to cwd-status.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const text = await read($, label)
    return text === null ? next(e) : next({ ...e, props: { ...e.props, modes: [...e.props.modes, text] } })
  })
}
