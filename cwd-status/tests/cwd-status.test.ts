import { describe, expect, test } from 'claude-code/testing'
import { cdTarget, tilde } from '../hooks/register'

const HOME = '/Users/me'

describe('cwd-status', () => {
  test('adds the session folder to the footer modes', async ($, on) => {
    let modes: readonly string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.cwd', () => ({ value: '/work/project' }))
    on('ui.status', () => ({ value: undefined }) as any)
    on('env.get', () => ({ value: HOME }) as any)
    on('ui.render', ($, e: any) => {
      modes = e.props.modes
      const { Text } = $.ui.resolve(e)
      return h(Text, null, modes.join(' & ')) as any
    })

    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/project' } as any)
    await $.ui.mount({ plugin: 'cwd-status', surface: 'terminal', component: 'SessionMode', props: { modes: ['focus'] } } as any)
    expect(modes).toEqual(['focus', '📁 /work/project'])
  })

  test('finds the folder a Bash command cds into', () => {
    expect(cdTarget('cd ~/otherfolder; ls -l', '/work', HOME)).toBe('/Users/me/otherfolder')
    expect(cdTarget('cd src && cd ../lib && make', '/work', HOME)).toBe('/work/lib')
    expect(cdTarget('cd "/tmp/my dir" || exit 1', '/work', HOME)).toBe('/tmp/my dir')
    expect(cdTarget('cd', '/work', HOME)).toBe(HOME)
    expect(cdTarget('ls -l && echo cd foo', '/work', HOME)).toBeUndefined()
  })

  test('shortens the home folder to ~', () => {
    expect(tilde('/Users/me/otherfolder', HOME)).toBe('~/otherfolder')
    expect(tilde('/Users/meme', HOME)).toBe('/Users/meme')
  })
})
