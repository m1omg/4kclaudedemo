# ROZMERY 4K

**ROZMERY 4K** je 4K verzia dema [ROZMERY](../8k/README.md) pre **Windows**,
**Linux** a **macOS (Intel)**: ten istý príbeh aj hudba, zhustené tak, aby
každá verzia bola jeden spustiteľný súbor s veľkosťou **do 4096 bajtov**.
Počas behu vypočíta všetko — 3D grafiku aj hudbu. Demo trvá **3:20**, rovnako
ako 8K verzia.

1. **Budova sa postaví sama.** Na modrotlači vyrastú stĺpy, poschodie po
   poschodí pribúdajú stropné dosky a za nimi sklo.
2. **Prechod do 4D.** Zapadne slnko, v miestnostiach sa rozsvieti a rozžiari
   sa obrys budovy. Budova sa rozoberie (jej čas beží späť) a obrys sa na tri
   hlboké údery zrúti do bodu. Z bodu vyrastie úsečka, štvorec, kocka a
   **teserakt** (4D kocka), ktorý sa otáča v štvrtom rozmere nad neónovou
   mriežkou. Od súmraku až po koniec dema je to jeden plynulý pohyb kamery,
   bez strihu.
3. **Mandelbulb.** Teserakt sa zrúti do bodu, z neho sa za úsvitu zrodí
   farebný Mandelbulb (s každou dobou mu pribudne jedna iterácia). Kamera sa
   ponorí do toho istého Mandelbulbu, pristane na „hrádzi" pozdĺž jeho
   rovníka a letí nízko krajinou fraktálu proti slnku: zíde do údolia,
   prejde ponad kopec a ďalšie údolie a vystúpa ponad obrovský útvar.
   Nakoniec vystúpi, vzdiali sa a ukáže celý Mandelbulb nad mriežkou.

Hudba je **synthwave** (125 BPM): kick, snare s „gated reverb", hi-haty,
oktávová saw basa, pad, arpeggio s ozvenou a hlavná melódia. Je zladená s
obrazom: obrys budovy sa zrúti na tri hlboké údery, arpeggio teseraktu má v
takte toľko tónov, koľko má útvar vrcholov (úsečka 2, štvorec 4, kocka 8,
teserakt 16), zrod Mandelbulbu sprevádza úder, pred začiatkom stavby,
dropom teseraktu a letom stúpa šum a demo končí akordom Cmaj7.

| Súbor | Platforma | Veľkosť |
|---|---|---|
| [`dist/rozmery4k-windows.exe`](dist/rozmery4k-windows.exe) | Windows (32-bit exe, beží aj na 64-bit) | 3681 B |
| [`dist/rozmery4k-linux`](dist/rozmery4k-linux) | Linux x86-64 (glibc) | 4084 B |
| [`dist/rozmery4k-macos`](dist/rozmery4k-macos) | macOS 10.13+ na Intel Macu | 4035 B |

### Čo sa nezmestilo (oproti 8K verzii)

Príbeh a hudba sú tie isté, ale v 4096 bajtoch je menej detailov:

- **Budova:** bez schodiska, atiky, strojovne a stožiara; sklo je tmavé, bez
  odrazov, stavia sa jednoduchšie (stĺpy rastú plynulo).
- **Teserakt:** bez rezov nadrovinou a priesvitných stien, hrany majú jednu
  farbu a otáča sa v jednej rovine 4D.
- **Mandelbulb:** bez „dýchania"; dráha letu je jeden vzorec namiesto 25
  bodov a kamera sa v zákrutách nenakláňa (letí vodorovne).
- **Kamera:** menej záberov (stavba budovy jeden, potom jeden plynulý pohyb).
- **Hudba:** bez tomov, zvončeka, crashu a vibrata; bez zvukových efektov
  pri rozoberaní budovy (nádych padu, šum, arpeggio odzadu) a bez tónu pre
  každú novú iteráciu Mandelbulbu; melódia sa druhýkrát neopakuje o oktávu
  vyššie. Akordy sú obyčajné septakordy (v časti s teseraktom Am7, Fmaj7,
  Dm7, Em7 namiesto Am9, Fmaj7#11, Dm9, E7sus4).
- Bez vyhladzovania (supersamplingu) budovy na výkonnej grafike; verzia pre
  macOS nekreslí na slabej grafike v menšom rozlíšení (ako 4K intro BRÁNA).

Na rozdiel od 8K svieti neónová mriežka modrotlače aj pod rodiacim sa
Mandelbulbom a v závere dema.

## Spustenie

Demo sa kedykoľvek ukončí klávesom **ESC** (na Linuxe a macOS ktoroukoľvek
klávesou), inak skončí samo po dohraní hudby. Beží na celej obrazovke v
natívnom rozlíšení a s neviditeľným kurzorom. Pri štarte sa počíta hudba (na
GPU, 3:20 stereo), preto je chvíľu čierna obrazovka.

Na Linuxe a vo Windows demo pri štarte zmeria rýchlosť grafiky na
najnáročnejšom mieste (výstup ponad obrovský útvar na konci letu). Na
slabšej grafike vykresľuje v menšom rozlíšení, najmenej 11/16 obrazovky v
každom smere, a obraz plynulo zväčší na celú obrazovku; na výkonnej grafike
beží v plnom rozlíšení. Verzia pre macOS kreslí vždy v plnom rozlíšení.
Animácia ide podľa času (podľa prehrávanej hudby), nie podľa počtu snímok,
takže nezávisí od obnovovacej frekvencie monitora.

### Windows

Stačí spustiť `rozmery4k-windows.exe`.

- Potrebné: grafika s OpenGL 3.3+, zvukové zariadenie a procesor s SSE4.2
  (požiadavka kompresora Crinkler 3.0).
- Na notebookoch s dvoma grafikami (NVIDIA Optimus, AMD) si demo vyžiada
  výkonnejšiu.
- Súbor je skomprimovaný demoscénickým linkerom Crinkler; niektoré antivírusy
  ho môžu mylne označiť ako podozrivý.

### Linux

```sh
chmod +x rozmery4k-linux
./rozmery4k-linux
```

- Obyčajná ELF binárka pre ľubovoľnú x86-64 distribúciu s glibc. Nič sa
  neinštaluje ani nezapisuje na disk.
- Potrebné: X11 alebo XWayland, OpenGL 4.1+ (s ovládačmi Mesa stačí 3.3),
  knižnica ALSA `libasound.so.2` (PipeWire/PulseAudio cez ňu fungujú),
  program `xzcat` a jadro 3.19+.
- Na notebookoch s dvoma grafikami: `DRI_PRIME=1 ./rozmery4k-linux` (Mesa)
  alebo `prime-run ./rozmery4k-linux` (NVIDIA).
- Prvých 236 bajtov súboru je malý ELF, ktorý zvyšok (LZMA) pošle cez
  `xzcat` do pamäťového súboru (`memfd`) a ten spustí — ten istý postup ako
  pri 4K intre BRÁNA.

### macOS (Intel)

```sh
chmod +x rozmery4k-macos
./rozmery4k-macos
```

- Krátky shell skript s pripojeným `tar` archívom (LZMA): rozbalí binárku do
  `/tmp/a` a spustí ju.
- Potrebné: macOS 10.13+, OpenGL 3.2+ core profil, GLUT a AudioToolbox
  (súčasť macOS). Na slabšej grafike (napr. Intel HD) môže byť plynulosť
  slabšia, lebo kreslí v plnom rozlíšení.

## Čo je vyskúšané

V cloudovom prostredí bez skutočnej grafickej karty (softvérové OpenGL Mesa
llvmpipe, virtuálne zvukové zariadenia):

- **Linux:** celé demo pod Xvfb s PipeWire: skončí samo po 3:20, ESC
  funguje, obraz správny. Nahratý zvuk je vzorka po vzorke zhodný s
  referenciou (39 z 39 kontrolovaných úsekov; nahrávanie pri plne vyťaženom
  procesore dvakrát vynechalo 1024 vzoriek, to je vlastnosť testovacieho
  prostredia).
- **macOS:** strojový kód macOS verzie spustený na Linuxe s náhradnými
  GLUT/OpenGL/AudioToolbox knižnicami (`../tools/macsim`): zvuk v celej
  dĺžke bit po bite zhodný, obraz správny. **Na skutočnom Macu zatiaľ nie.**
- **Windows:** Wine 9.0 s llvmpipe: demo skončí samo, obraz správny, zvuk
  vzorka po vzorke zhodný s referenciou (31 z 33 kontrolovaných úsekov; v
  zvyšných Wine pri plne vyťaženom procesore vynechal kúsok).
  **Na skutočných Windows zatiaľ nie.**
- Shadery v minifikovanej podobe vykresľujú presne to isté ako zdrojové
  (hudba aj snímky), aj v core profile ako na macOS —
  `tools/check_shaders.sh`.
- Kamera sa pri lete nikdy nedotkne povrchu fraktálu a otáča sa plynulo
  (najviac 30° za takt, 8K verzia 45°) — overené výpočtom v plnej presnosti
  (`tools/flypath.py`).
- Hlasitosti nástrojov sú vyvážené podľa 8K verzie (`tools/stems.py`).

Na skutočných grafikách (NVIDIA, AMD, Intel) ani na skutočných Windows a
Macu demo zatiaľ nebežalo. Shadery dodržiavajú pravidlá, ktoré sa ukázali ako
dôležité pri 4K intre na NVIDIA (žiadne celé čísla v preťažených vstavaných
funkciách, žiadne obrátené hranice `smoothstep`, žiadne nedefinované
konštrukcie GLSL).

## Ako je to urobené

Rovnako ako 8K verzia, len úspornejšie:

- **Hudba:** fragment shader (`src/synth.frag`) raz pri štarte vypočíta
  všetkých 8 805 888 stereo vzoriek do float textúry, program ich prečíta a
  prehrá. Všetky nástroje sú syntetizované, časovanie je odvodené od
  celočíselného indexu vzorky. Akordy netreba ukladať do tabuľky: tóny sú
  tercie nad koreňom v stupnici C dur, `48 + ((koreň + 2k)·12 + 5) / 7`, a
  korene celej skladby sú v jednom 32-bitovom čísle. V tabuľke ostala len
  melódia (25 čísel: výška a dĺžka tónu).
- **Obraz:** jeden fragment shader (`src/scene.frag`) s raymarchingom.
  Budova je z niekoľkých SDF kvádrov, ktoré rastú podľa „hodín budovy" (tie
  pri rozoberaní bežia späť). Teserakt sa ráta analyticky: 16 vrcholov
  otočených v 4D a premietnutých perspektívou do 3D a potom na obrazovku,
  hrany žiaria podľa vzdialenosti pixelu od úsečky. Mandelbulb má mocninu 8 a
  farby z orbit trapu. Kamera od súmraku až po koniec ide po jednej dráhe v
  sférických súradniciach okolo stredu teseraktu a Mandelbulbu. Výška letu
  je vzorec `0,8 + exp(a + b·cos(0,72·t + p) + d·smoothstep(...))`, ktorého
  koeficienty som prispôsobil mape výšky povrchu Mandelbulbu tak, aby kamera
  letela čo najnižšie a nikdy sa ho nedotkla (`tools/flypath.py`).
- **Zmenšovanie:** minifikátor (`tools/minify.py`) premenuje identifikátory a
  skráti čísla; `tools/namesearch.py` vyskúša tisíce priradení krátkych mien a
  nechá to, ktoré LZMA skomprimuje najlepšie (ušetrí asi 45 bajtov). Každá
  časť shaderov je zmeraná, koľko bajtov stojí po kompresii.
- **Platformy:** vrstvy pre Windows (C + Crinkler), Linux (ručne písaný ELF v
  NASM) a macOS (NASM + ld64.lld, dropper) sú tie zo 4K intra BRÁNA v tomto
  repozitári (s drobnými úpravami: iné shadery a iný okamih merania
  rýchlosti).

## Zostavenie

```sh
./build.sh
```

Nástroje sú tie isté ako pri 4K intre (`../README.md`): python3, glslang,
nasm, xz, tar, clang, lld, wine + Crinkler 3.0. Pre kontrolu shaderov treba X
server s OpenGL a `../tools/preview.c` skompilovaný do `$S/preview`. Skript
overí, že každý súbor v `dist/` má najviac 4096 bajtov. Technické poznámky
pre ďalšiu prácu sú v [`HANDOFF.md`](HANDOFF.md).
