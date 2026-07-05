# 🟩 LIMEdit BLOCK

**A modern operating environment with a hybrid kernel, where the GUI *is* the terminal.**

LIMEdit BLOCK is a self-contained, browser-based operating system *tribute*. It
doesn't run one kernel — it runs a **hybrid kernel** with two personalities
welded together, and a supervisor called **LIMAWEK** that hot-switches between
them depending on what each workload needs:

| Personality | Modelled on | Services |
|---|---|---|
| **MS-DOS real-mode** (16-bit) | [microsoft/MS-DOS](https://github.com/microsoft/MS-DOS) (v1.25 / 2.0 / 4.0, MIT) | the classic `COMMAND.COM` verbs — `DIR`, `TYPE`, `VER`, `MEM` … |
| **Linux (Arch)** (64-bit, `linux 6.14.2-arch1`) | Arch Linux, newest rolling | modern userland, `pacman`, **and every third-party Linux application** |

The desktop chrome is **System 9.2.2 / macOS**-style (top menu bar, traffic-light
windows, dock).

> **Scope, honestly:** you cannot compile the Linux and MS-DOS kernels into a
> repository web app, so BLOCK reproduces their **behaviour, ABI feel, and
> command surface** in a pure-client-side environment. No real disk or CPU mode
> is touched. It is deliberately **independent of the LimeEdit editor** in the
> rest of the repo — it shares nothing but the repository.

---

## The hybrid kernel & LIMAWEK

**LIMAWEK** — the *LIMe Adaptive Workload Arbitration & Execution Kernel-manager*
— watches every workload and decides which personality's ABI it needs, then
hot-switches the kernel there and logs the transition:

```
[lime@limebox ~]$ DIR                     # a DOS verb…
limawek: 'DIR' needs DOS ABI  →  kernel switched to MS-DOS real-mode (real-mode · 16-bit)
C:\HOME\LIME> ls                          # …a Linux verb switches it right back
limawek: 'ls' needs LINUX ABI  →  kernel switched to Linux (Arch) (protected-mode · 64-bit)
[lime@limebox ~]$
```

Notice the **prompt itself changes** (`C:\…>` vs `[lime@limebox ~]$`) and the
menu-bar badge (`◆ dos·real-mode` vs `◆ arch·6.14.2`) — that is the hybrid
kernel changing "where it needs to."

Inspect and drive it:

```
kernel                 # show the hybrid kernel + both personalities
limawek status         # the arbiter's state
limawek log            # every kernel transition so far
limawek mode dos       # force a personality
dos                    # lock into an immersive MS-DOS session (EXIT to leave)
```

### Third-party Linux applications need the Linux kernel

Install from `pacman`, then `run` it — LIMAWEK loads the Linux (Arch) kernel to
service the binary, spawns a process, and (if it's a GUI app) opens a window:

```
pacman -S firefox
run firefox            # → limawek loads linux 6.14.2-arch1, [pid] firefox running
```

## The GUI is the terminal

BlockWM (the window manager) is **always on**, because it boots with a maximized
**root console** that can never be closed — the terminal *is* the desktop.
Every app, and every `run`-launched Linux binary, floats above it as another
managed window.

## Run it

```bash
node limedit-block/server.js       # → http://localhost:4000  (dependency-free)
# or just open limedit-block/index.html — it's 100% client-side
```

## The shell (`limesh`) — four dialects, one prompt

Command names are **case-insensitive**.

- **Modern / Arch userland:** `ls cd pwd cat mkdir rm cp mv tree grep find ps kill free df uname history alias …`
- **MS-DOS verbs (→ real-mode):** `DIR CLS TYPE COPY DEL REN VER MEM MD RD …`
- **PowerShell cmdlets:** `Get-ChildItem Set-Location Get-Content Write-Host Get-Process New-Item $PSVersionTable …` (+ Verb-Noun fallback)
- **Fun:** `neofetch` (Arch-style animated banner), `cowsay` `fortune` `ascii`/`figlet` `lolcat` `matrix` `sl` `coffee` `sudo`
- **Live code:** `code 2 + 2` — evaluates JavaScript with `shell`, `fs`, `sys`, `gui` in scope.

### Fallback-GUI

Graphical apps such as the browser need richer chrome than the shell:

```
fallback-gui ~allow      # unlock the full, detailed app chrome
fallback-gui ~disable    # degrade apps to lightweight, shell-first windows
```

---

## Files

```
limedit-block/
├─ index.html          boot screen + desktop shell
├─ server.js           dependency-free static server
├─ css/block.css       System-9 desktop, DOS look, themes, wallpapers
└─ js/
   ├─ kernel.js        hybrid kernel + LIMAWEK arbiter + VFS + process table
   ├─ neofetch.js      Arch-style animated ASCII banner
   ├─ commands.js      the command library (+ pacman, ABI map) and ASCII font
   ├─ shell.js         limesh: mode-aware terminal runtime
   ├─ apps.js          browser, files, about, editor, settings, monitor
   ├─ gui.js           BlockWM: always-on WM, root console, menu bar, dock
   └─ boot.js          the power-on sequence (DOS POST → Arch handoff)
```
