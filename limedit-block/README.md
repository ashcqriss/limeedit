# 🟩 LIMEdit BLOCK

**A modern operating environment where the GUI *is* the shell.**

LIMEdit BLOCK is a self-contained, browser-based operating system *tribute* that
welds together two officially open-sourced code bases and dresses the result in
a classic-Mac desktop:

| Ingredient | What BLOCK borrows | Source |
|---|---|---|
| **Arch Linux** | rolling-release feel, the `pacman` package model, FHS layout (`/usr`, `/etc`, `/home`), modern GNU userland semantics | archlinux.org |
| **MS-DOS** | the classic `COMMAND.COM` verbs — `DIR`, `CLS`, `TYPE`, `VER`, `MEM` … (case-insensitive) | [microsoft/MS-DOS](https://github.com/microsoft/MS-DOS) (MIT) |
| **System 9.2.2 / macOS** | the top menu bar, traffic-light windows, and a dock | — |

> **Scope, honestly:** BLOCK is a faithful *emulation*, not a bootable kernel.
> You cannot compile the Linux and MS-DOS kernels into a repository web app, so
> BLOCK reproduces the **behaviour and command surface** of those systems in a
> pure-client-side environment. Everything runs in your browser; no real disk is
> touched, which is what makes it safe to run anywhere.

This project is intentionally **independent of the LimeEdit editor** in the rest
of the repo — it shares nothing but the repository.

---

## Run it

```bash
# Option A — dependency-free static server
node limedit-block/server.js            # → http://localhost:4000

# Option B — just open the file
open limedit-block/index.html           # it's 100% client-side
```

## The shell (`limesh`)

One shell, four dialects living side by side. Command names are
**case-insensitive**.

- **Modern / Arch userland:** `ls` `cd` `pwd` `cat` `mkdir` `rm` `cp` `mv`
  `tree` `grep` `find` `ps` `kill` `free` `df` `uname` `history` `alias` …
- **MS-DOS verbs:** `DIR` `CLS` `TYPE` `COPY` `DEL` `REN` `VER` `MEM` `MD` `RD` …
- **PowerShell cmdlets:** `Get-ChildItem` `Set-Location` `Get-Content`
  `Write-Host` `Get-Process` `New-Item` `Remove-Item` `$PSVersionTable` … (plus a
  forgiving Verb-Noun fallback)
- **Fun:** `neofetch` (animated ASCII banner), `cowsay`, `fortune`, `ascii` /
  `figlet`, `lolcat`, `matrix`, `sl`, `coffee`, `sudo` …

### Package manager

```
pacman -Syu                 # upgrade the world
pacman -S block-browser     # install a package
pacman -Ss editor           # search the repos
pacman -Q                   # list installed packages
apt install firefox         # Debian front-end → routes to pacman
```

### Run code live in the shell

```
code 2 + 2                  # → 4
code sys.version            # read kernel/system state
code print(fs.list('/home/lime'))
```
`code` (aliases `js`, `eval`, `run`) evaluates JavaScript with `shell`, `fs`,
`sys`, and `gui` in scope, so you can manipulate the running shell directly.

## The GUI

The desktop **is** the shell. A System-9-style menu bar sits on top; windows
have traffic-light controls; a dock sits at the bottom. Launch apps from the
`▦` menu, the Apple menu, or the shell:

```
open browser        # the detailed web browser
open files          # VFS file browser
open editor         # a tiny built-in text editor
open monitor        # live activity monitor
open settings       # System Preferences
```

### Fallback-GUI (rich app chrome)

Graphical apps such as the browser need a richer GUI than the shell. Toggle it:

```
fallback-gui ~allow      # unlock the full, detailed app chrome
fallback-gui ~disable    # degrade apps to lightweight, shell-first windows
```

With the fallback-GUI **disabled**, the browser renders a minimal, text-first
view; **allowed**, it renders full chrome. The state is shown in the menu bar
(`GUI: shell` / `GUI: rich`).

---

## Files

```
limedit-block/
├─ index.html          boot screen + desktop shell
├─ server.js           dependency-free static server
├─ css/block.css       System-9 desktop styling, themes, wallpapers
└─ js/
   ├─ kernel.js        in-memory VFS, process table, system metadata
   ├─ commands.js      the command library (+ pacman) and ASCII font
   ├─ shell.js         limesh: the interactive terminal runtime
   ├─ neofetch.js      the animated ASCII system banner
   ├─ apps.js          browser, files, about, editor, settings, monitor
   ├─ gui.js           Block9 window manager, menu bar, dock
   └─ boot.js          the power-on sequence
```
