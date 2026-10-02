import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const cwd = atom({ plugin: 'cwd-status', key: 'cwd' } as const, null)

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

export function tilde(dir: string, home: string | undefined): string {
  return home && (dir === home || dir.startsWith(`${home}/`)) ? `~${dir.slice(home.length)}` : dir
}

async function show($: EngineInterface, dir: string) {
  const label = tilde(dir, await $.env.get('HOME'))
  if ((await read($, cwd)) !== label) await update($, cwd, () => label)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    $.ui.status(undefined) // clear the line an earlier version pinned
    await show($, await $.session.cwd())
    return result
  })

  // A `cd` inside a Bash command moves that command only (the shell is reset when it
  // leaves the project), so show where it runs, and keep that until the next tool.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const before = await $.session.cwd()
    const target = cdTarget(e.command, before, await $.env.get('HOME'))
    if (target) await show($, target)
    const result = await next(e)
    const after = await $.session.cwd()
    await show($, after !== before || !target ? after : target)
    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.tool !== 'Bash') await show($, await $.session.cwd())
    return result
  })

  on('classic.CwdChanged', async ($, e, next) => {
    const result = await next(e)
    await show($, e.new_cwd)
    return result
  })

  // Shown with the footer's mode labels, without a plugin-name prefix.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const dir = await read($, cwd)
    return dir === null ? next(e) : next({ ...e, props: { ...e.props, modes: [...e.props.modes, `📁 ${dir}`] } })
  })
}
