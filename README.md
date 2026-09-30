# BRÁNA — 4K intro

**BRÁNA** („brána") je 4K intro pre **Windows**, **Linux** a **macOS (Intel)**.
Každá verzia je jeden spustiteľný súbor s veľkosťou **do 4096 bajtov**, ktorý
počas behu vypočíta všetko — 3D grafiku aj hudbu. Intro trvá **2:26**.

Nočný horizont so zrkadlovou hladinou, z ktorej vyrastajú monolity, uprostred
žiariaca brána. Kamera ňou pri prvom drope preletí do tunela, v breakdowne sa
zastaví pri jadre zo sústredných prstencov, v druhom drope letí ešte rýchlejšie
a na konci sa vráti na horizont, kde sa všetko pomaly ponorí späť do tmy.

| Súbor | Platforma | Veľkosť |
|---|---|---|
| [`dist/brana-windows.exe`](dist/brana-windows.exe) | Windows (32-bit exe, beží aj na 64-bit) | 3122 B |
| [`dist/brana-linux`](dist/brana-linux) | Linux x86-64 (glibc) | 3953 B |
| [`dist/brana-macos`](dist/brana-macos) | macOS 10.13+ na Intel Macu | 4057 B |

## Spustenie

Intro sa kedykoľvek ukončí klávesom **ESC** (na Linuxe a macOS ktoroukoľvek
klávesou), inak skončí samo po dohraní hudby. Beží na celej obrazovke v
natívnom rozlíšení a s neviditeľným kurzorom. Pri štarte sa asi sekundu počíta
hudba (na GPU), preto je chvíľu čierna obrazovka.

### Windows

Stačí spustiť `brana-windows.exe` (dvojklik alebo z príkazového riadka).

- Potrebné: grafika s OpenGL 4.1+, zvukové zariadenie a procesor s SSE4.2
  (požiadavka kompresora Crinkler 3.0, spĺňa ju prakticky každý procesor od
  roku 2011).
- Súbor je skomprimovaný demoscénickým linkerom Crinkler. Niektoré antivírusy
  takéto súbory mylne označujú ako podozrivé (známy falošný poplach pri 4k
  intrách).

### Linux

```sh
chmod +x brana-linux
./brana-linux
```

- Je to obyčajná ELF binárka pre ľubovoľnú x86-64 distribúciu s glibc (Ubuntu,
  Debian, Fedora, Arch, openSUSE, …). Nič sa neinštaluje ani nezapisuje na disk.
- Potrebné: X11 alebo XWayland (Wayland desktopy ho majú), OpenGL 4.1+ (Mesa
  alebo NVIDIA), knižnica ALSA `libasound.so.2` (PipeWire/PulseAudio cez ňu
  fungujú), program `xzcat` (balík `xz`/`xz-utils`, predinštalovaný takmer
  všade) a jadro 3.19+.
- Ako to funguje: prvých 240 bajtov súboru je malý ELF, ktorý zvyšok súboru
  (LZMA dáta) pošle cez `/usr/bin/xzcat` do pamäťového súboru (`memfd`) a ten
  spustí. Samotné intro importuje z glibc iba `dlopen` a `dlsym` bez verzií
  symbolov, takže funguje na starej (libdl) aj novej (2.34+) glibc.

### macOS (Intel)

V Termináli:

```sh
chmod +x brana-macos
./brana-macos
```

- Súbor je krátky shell skript s pripojeným `tar.xz` archívom: rozbalí 12 KB
  binárku do `/tmp/a` (systémovým `tar`) a spustí ju. macOS nemá spôsob, ako
  spustiť skomprimovanú Mach-O binárku priamo, preto je to riešené takto (tzv.
  dropper, bežná prax pri 4k intrách pre Linux/macOS).
- Potrebné: macOS 10.13 alebo novší, OpenGL 3.2+ core profil, GLUT a
  AudioToolbox (súčasť macOS).
- **Upozornenie:** túto verziu som nemohol spustiť na skutočnom Macu (vývoj
  prebiehal na Linuxe bez Apple SDK). Jej strojový kód je otestovaný
  v simulácii [`tools/macsim`](tools/macsim): ten istý assembler preložený
  ako Linux ELF, s náhradnými GLUT/OpenGL/AudioToolbox knižnicami na macOS
  cestách — obraz, zvuk aj ukončenie fungujú a kód v Mach-O súbore je bajt po
  bajte zhodný (okrem 31 relokácií). Overiť som nemohol samotné načítanie
  Mach-O súboru cez `dyld` a správanie Apple GLUT.

## Pravidlá

| Pravidlo | Ako je splnené |
|---|---|
| max. 4096 bajtov | všetky tri súbory sú menšie (tabuľka vyššie); build to kontroluje |
| jeden súbor | áno; kód, shadery, syntetizátor aj noty sú v jednom súbore |
| generovanie v reálnom čase | grafika je raymarching v GLSL pre každý snímok, hudbu pri štarte vypočíta GPU zo 48 čísel nôt a vzorcov |
| žiadne externé assety | nič sa nesťahuje; používajú sa len systémové knižnice (OpenGL, X11, ALSA, WinMM, GLUT, AudioToolbox) a na Linuxe/macOS systémový dekompresor (`xzcat`, `tar`) |
| dĺžka | 2:26 |
| ukončenie | ESC kedykoľvek (Linux/macOS: ktorákoľvek klávesa) |
| skrytý kurzor | áno, na všetkých platformách |
| konzistentnosť | všetko je deterministické, „náhoda" sú len hash funkcie |
| pôvodný obsah | hudba (akordy Dm9 – B♭maj9 – Gm9 – A7, vlastná melódia), syntéza aj grafika sú napísané pre toto intro |

Animácia nezávisí od obnovovacej frekvencie monitora ani od FPS: obraz aj
synchronizácia s hudbou sú funkciou času (na Windows priamo pozícia prehrávania
zvuku, na Linuxe a macOS hodiny spustené spolu so zvukom). Na slabšej grafike
bude intro len menej plynulé, nikdy nie pomalšie.

## Priebeh

| Čas | Hudba | Obraz |
|---|---|---|
| 0:00 | pad, neskôr arpeggio | hviezdy, kamera klesá k horizontu, rozsvieti sa brána |
| 0:16 | hi-hat, bas | z hladiny vyrastajú monolity so žiariacimi hranami |
| 0:32 | kick | brána a svetlá pulzujú do rytmu |
| 0:40 | riser, vírenie | kamera zrýchľuje a stúpa do stredu brány |
| 0:48 | drop | prelet bránou do tunela; tvar a farba rámov sa menia každé 4 takty |
| 1:20 | breakdown s melódiou | jadro zo sústredných rotujúcich prstencov |
| 1:36 | druhý drop s melódiou | rýchlejší tunel zo segmentov |
| 2:08 | outro | návrat na horizont, monolity sa ponárajú, stmievanie |

## Ako to funguje

- **Hudba** ([`src/music.frag`](src/music.frag)) je fragment shader. Pri
  štarte sa vykreslí do textúry 1024 × 3144 s 32-bitovými float hodnotami:
  každý pixel obsahuje dve stereo vzorky (44,1 kHz), celá skladba jedným
  vykreslením. Nástroje sú bezstavové vzorce: kick so sweepom frekvencie,
  hi-haty a clap zo šumu (celočíselný hash), rolling bas cez FM, pad z
  rozladených pílových vĺn (discrete summation formula), FM arpeggio s
  ping-pong echom a lead s vibratom a echom; sidechain, riser, vírenie
  a crash. Časy sa počítajú z celočíselného indexu vzorky, takže ani na konci
  skladby nevzniká fázový šum z presnosti float čísel.
- **Grafika** ([`src/visual.frag`](src/visual.frag)) je sphere tracing
  so štyrmi scénami, zrkadlovým odrazom podlahy, ambient occlusion,
  neónovou žiarou, hmlou, hviezdami a filmovým zrnom. Všetko je funkcia času
  prepočítaného na takty, preto sedí na hudbu.
- **Minifikácia**: [`tools/minify.py`](tools/minify.py) odstráni komentáre
  a medzery a premenuje identifikátory podľa rozsahu platnosti.
  [`tools/check_shaders.sh`](tools/check_shaders.sh) overí, že minifikovaná
  verzia generuje bitovo rovnaký zvuk a obraz.
- **Windows** ([`src/win/main.c`](src/win/main.c)): okno, OpenGL cez WGL,
  zvuk cez `waveOut`; zlinkované a skomprimované Crinklerom.
- **Linux** ([`src/linux/main.asm`](src/linux/main.asm)): celý ELF súbor
  napísaný v assembleri (vlastná hlavička a dynamická sekcia), X11 + GLX,
  ALSA v samostatnom vlákne; [`src/linux/stub.asm`](src/linux/stub.asm)
  je samorozbaľovací ELF.
- **macOS** ([`src/mac/main.asm`](src/mac/main.asm)): assembler, GLUT
  s OpenGL core profilom (preto aj malý vertex shader), AudioQueue; zlinkované
  `ld64.lld` s ručne napísaným `.tbd` súborom namiesto Apple SDK.

## Zostavenie

Na Linuxe (testované na Ubuntu 24.04):

```sh
sudo apt install python3 glslang-tools nasm xz-utils clang lld llvm wine wine32:i386
# Crinkler 3.0: https://github.com/runestubbe/Crinkler (releases/crinkler30b)
CRINKLER=/cesta/k/Crinkler.exe ./build.sh
```

`build.sh` zminifikuje shadery, zostaví všetky tri verzie do `dist/` a overí
limit 4096 bajtov. Pri vývoji pomáhali
[`tools/preview.c`](tools/preview.c) (vykreslenie snímok a WAV súboru
z ľubovoľného shadera), [`tools/contact.py`](tools/contact.py) a
[`tools/analyze_audio.py`](tools/analyze_audio.py).

## Testovanie

- Windows verzia: spustená pod Wine 9.0 (Xvfb, Mesa llvmpipe, PulseAudio):
  obraz, zvuk, časovanie aj ukončenie ESC fungujú. Na skutočnom Windows som ju
  spustiť nemohol.
- Linux verzia: spustená na Ubuntu 24.04 (Xvfb, Mesa llvmpipe, PulseAudio),
  vrátane ukončenia ESC; kompatibilita dynamickej sekcie overená aj so starým
  dynamickým linkerom glibc 2.31.
- macOS verzia: pozri upozornenie vyššie.
