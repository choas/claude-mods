import { describe, expect, test } from 'claude-code/testing'
import { cdTarget, format, parseStatus } from '../hooks/register'

describe('git-status', () => {
  test('counts uncommitted files and unpushed commits', () => {
    const out = [
      '# branch.oid 0123456789abcdef',
      '# branch.head main',
      '# branch.upstream origin/main',
      '# branch.ab +2 -1',
      '1 .M N... 100644 100644 100644 aaa bbb src/a.ts',
      '2 R. N... 100644 100644 100644 aaa bbb R100 b.ts\told.ts',
      '? new.txt',
      '',
    ].join('\n')
    const s = parseStatus(out)
    expect(s).toEqual({ branch: 'main', changed: 3, ahead: 2 })
    expect(format(s)).toBe('⎇ main ●3 ↑2')
  })

  test('a clean branch without upstream', () => {
    const s = parseStatus('# branch.oid abc\n# branch.head feature\n')
    expect(s.ahead).toBeUndefined()
    expect(format({ ...s, ahead: 0 })).toBe('⎇ feature')
  })

  test('detached HEAD shows the short hash', () => {
    expect(parseStatus('# branch.oid 0123456789abcdef\n# branch.head (detached)\n').branch).toBe('0123456')
  })

  test('adds the label to the footer modes', async ($, on) => {
    let modes: readonly string[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('session.cwd', () => ({ value: '/work/project' }))
    on('process.run', ($, e: any) => {
      if (e.argv[1] === 'status')
        return { value: { exitCode: 0, stdout: '# branch.oid abc\n# branch.head main\n# branch.ab +1 -0\n? x\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as any
      return { value: { exitCode: 0, stdout: '0\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } } as any
    })
    on('ui.render', ($, e: any) => {
      modes = e.props.modes
      const { Text } = $.ui.resolve(e)
      return h(Text, null, modes.join(' & ')) as any
    })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/project' } as any)
    await $.ui.mount({ plugin: 'git-status', surface: 'terminal', component: 'SessionMode', props: { modes: [] } } as any)
    expect(modes).toEqual(['⎇ main ●1 ↑1'])
  })
})

describe('git-status cd', () => {
  test('finds the folder a Bash command cds into', () => {
    expect(cdTarget('cd ../marketplace && git init', '/p/file_path', '/h')).toBe('/p/marketplace')
    expect(cdTarget('cd ~/x; ls', '/w', '/h')).toBe('/h/x')
    expect(cdTarget('echo cd foo', '/w', '/h')).toBeUndefined()
  })
})
