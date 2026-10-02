# my-mods

Small [Claude Code](https://claude.com/claude-code) mods that add live info to the footer, next to the mode labels.

| Mod | Shows | Example |
| --- | --- | --- |
| **cwd-status** | The folder Claude is working in, including where a Bash command `cd`s to | `📁 ~/prj/app` |
| **git-status** | Branch, uncommitted files and unpushed commits of that folder's repo | `⎇ main ●3 ↑2` |

Together they read like `📁 ~/prj/app  ⎇ main ●3 ↑2`.

## Install

In Claude Code, add this marketplace once:

```
/plugin marketplace add choas/claude-mods
```

Then install one or both mods:

```
/plugin install cwd-status@my-mods
/plugin install git-status@my-mods
```

Run `/reload-plugins` (or restart Claude Code) and the labels show up in the footer.

You can also browse and install them interactively with `/plugin` → **Marketplaces** → **my-mods**.

### Update

```
/plugin marketplace update my-mods
```

### Uninstall

```
/plugin uninstall cwd-status@my-mods
/plugin uninstall git-status@my-mods
```

## cwd-status

Shows `📁 <folder>` with your home folder shortened to `~`.

- Follows the session's working folder.
- When a Bash command `cd`s or `pushd`es somewhere (`cd ../other && make`), it shows that folder until the next tool runs.

## git-status

Shows the git state of the current folder:

| Part | Meaning |
| --- | --- |
| `⎇ main` | Current branch (short commit hash on a detached HEAD) |
| `●3` | Uncommitted entries: modified, staged, renamed, conflicted and untracked |
| `↑2` | Commits not pushed yet: ahead of the upstream, or, without an upstream, commits on no remote |

- `●` and `↑` only appear when non-zero; outside a git repo nothing is shown.
- Refreshes when the session starts, on every prompt (so commits made in another terminal show up), after Bash/Edit/Write tool calls, and when the folder changes.
- Follows `cd` inside Bash commands on its own, so it works without cwd-status.
- Uses `git status --porcelain=v2 --branch` with optional locks off and a 5 s timeout, so it never blocks your repo.

Requires `git` on your `PATH`.

## Development

Each mod is a plugin folder with a hooks module (`hooks/register.ts`), a state contract (`types/index.d.ts`) and tests:

```sh
claude plugin validate git-status
claude plugin test git-status
```

To try local changes, point Claude Code at the folder: `claude --plugin-dir ./git-status`.

## License

MIT
