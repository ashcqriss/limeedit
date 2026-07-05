# 🟩 LIMEdit BLOCK

**A modern operating environment with a hybrid kernel, where the GUI *is* the terminal.**
Version 1.1.0 “Second Squeeze”.

LIMEdit BLOCK is a self-contained, browser-based operating system *tribute*. It
doesn't run one kernel — it runs a **hybrid kernel** with two personalities
welded together, and a supervisor called **LIMAWEK** that hot-switches between
them depending on what each workload needs:

| Personality | Modelled on | Services |
|---|---|---|
| **MS-DOS real-mode** (16-bit) | [microsoft/MS-DOS](https://github.com/microsoft/MS-DOS) (v1.25 / 2.0 / 4.0, MIT) | the classic `COMMAND.COM` verbs — `DIR`, `TYPE`, `VER`, `MEM` … |
| **Linux (Arch)** (64-bit, `linux 6.14.2-arch1`) | Arch Linux, newest rolling | modern userland, `pacman`, **and every third-party Linux application** |

> **Scope, honestly:** you cannot compile the Linux and MS-DOS kernels into a
> repository web app, so BLOCK reproduces their **behaviour, ABI feel, and
> command surface** in a pure-client-side environment. No real disk or CPU mode
> is touched. It is deliberately **independent of the LimeEdit editor** in the
> rest of the repo — it shares nothing but the repository.

---

## Run it

```bash
node limedit-block/server.js       # → http://localhost:4000  (dependency-free)
# or just open limedit-block/index.html — it's 100% client-side
```

Boot is two-phase: a BIOS POST + real-mode DOS handoff, then a Mac-OS-9-style
**Welcome splash** with an extension parade. Click or press any key to skip.

## The hybrid kernel & LIMAWEK

**LIMAWEK** — the *LIMe Adaptive Workload Arbitration & Execution
Kernel-manager* — watches every workload, decides which personality's ABI it
needs, hot-switches the kernel there, and logs the transition:

```
[lime@limebox ~]$ DIR                     # a DOS verb…
limawek: 'DIR' needs DOS ABI  →  kernel switched to MS-DOS real-mode (real-mode · 16-bit)
C:\HOME\LIME> ls                          # …a Linux verb switches it right back
limawek: 'ls' needs LINUX ABI  →  kernel switched to Linux (Arch) (protected-mode · 64-bit)
[lime@limebox ~]$
```

The **prompt itself changes** (`C:\…>` vs `[lime@limebox ~]$`), the console
adopts the black-on-gray MS-DOS look in real-mode, and the menu-bar badge
tracks the live personality (`◆ dos·real-mode` vs `◆ arch·6.14.2`).

```
kernel                 # show the hybrid kernel + both personalities
limawek status|log     # the arbiter's state / every transition
limawek mode dos       # force a personality
dos                    # immersive MS-DOS: CRT scanlines, chrome recedes (EXIT to leave)
```

**Third-party Linux applications need the Linux kernel.** Install from
`pacman`, then `run` it — LIMAWEK loads the Arch kernel, spawns a process, and
GUI apps get a window tagged `pid · linux`:

```
pacman -S firefox && run firefox
pacman -S htop && run htop
```

## The desktop (Block9 / BlockWM)

System 9.2.2 **Platinum**, modernised:

- **The GUI is the terminal** — BlockWM boots a maximized *root console* that
  can never be closed, so the WM is always active. Everything else floats
  above it.
- **Platinum chrome** — pinstriped title bars on the focused window, centered
  window titles, a platinum menu bar with **File · Edit · View · Special** and
  a System-9-style **Application menu** (far right) listing open windows.
- **Windows** — drag, resize (grip in the corner), minimize (genie-ish dip to
  the dock), zoom (green light or double-click the title), animated open.
- **Desktop icons** — BlockFS, Home, Trash float over the console, top-right.
- **Launcher dock** — six launchers with running-indicator dots; click to
  launch or to restore a minimized window.
- **Apps** — Browser (bookmarks bar in rich mode), Files (toolbar, breadcrumbs,
  preview, new/delete), Editor (Ln/Col status bar), Activity Monitor (live CPU
  bars, end-process buttons), System Preferences (switches, wallpaper
  swatches), About.
- **Persistence** — theme, wallpaper, fallback-GUI, and reduced-motion survive
  reboots (localStorage).

### Fallback-GUI

Graphical apps need richer chrome than the shell:

```
fallback-gui ~allow      # full, detailed app chrome (browser grows a bookmarks bar)
fallback-gui ~disable    # lightweight, shell-first windows
```

## The shell (`limesh`)

Four dialects, one prompt — command names are **case-insensitive** — plus real
shell plumbing:

```
help | grep pacman            # pipes: grep · head · tail · wc · sort · uniq
ls > listing.txt              # redirection (> and >>)
mkdir demo && cd demo         # chaining
```

- **Modern / Arch userland:** `ls cd pwd cat head tail wc mkdir rm cp mv tree
  grep find which echo uname hostname ps kill htop free df ping history alias
  edit …`
- **MS-DOS verbs (→ real-mode):** `DIR CLS TYPE COPY DEL REN VER MEM MD RD …`
- **PowerShell cmdlets:** `Get-ChildItem Set-Location Get-Content Write-Host
  Get-Process New-Item $PSVersionTable …`
- **Fun:** `neofetch` (Arch-style animated banner) `cowsay` `fortune`
  `ascii`/`figlet` `lolcat` `matrix` `sl` `coffee` `sudo`
- **Live code:** `code 2 + 2` — JavaScript with `shell`, `fs`, `sys`, `gui` in
  scope, so you can manipulate the running shell.

---

## Files

```
limedit-block/
├─ index.html          boot (POST + splash) + desktop shell
├─ server.js           dependency-free static server
├─ css/block.css       Platinum chrome, DOS look, themes, wallpapers, animations
└─ js/
   ├─ kernel.js        hybrid kernel + LIMAWEK arbiter + VFS + process table
   ├─ neofetch.js      Arch-style animated ASCII banner
   ├─ commands.js      command library (+ pacman, ABI map) and ASCII font
   ├─ shell.js         limesh: pipes/redirect/chaining, mode-aware prompt
   ├─ apps.js          browser, files, about, editor, settings, monitor
   ├─ gui.js           BlockWM: root console, Platinum WM, dock, menus, icons
   └─ boot.js          two-phase power-on sequence
```
