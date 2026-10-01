# ROZMERY — 8K demo

**ROZMERY** je 8K demo pre **Windows**, **Linux** a **macOS (Intel)**. Každá
verzia je jeden spustiteľný súbor s veľkosťou **do 8192 bajtov**, ktorý počas
behu vypočíta všetko — 3D grafiku aj hudbu. Demo trvá **3:12**.

1. **Budova sa postaví sama.** Najprv sa na zemi nakreslí jej pôdorys ako
   modrotlač, potom z námestia vyrastie základová doska, stĺpy rastú poschodie
   po poschodí, stropné dosky sa vysúvajú z jadra, schodisko pribúda po jednom
   schode na každú dobu hudby, fasáda dostane stĺpiky a sklá, nakoniec atika,
   strojovňa a stožiar. Zapadne slnko a v oknách sa rozsvieti.
2. **Prechod do 4D.** Okolo budovy sa rozžiari jej obrys, budova sa „pretočí
   späť" a rozoberie (aj hudba vtedy hrá odzadu, 16× rýchlejšie). Obrys sa
   zrúti: kocka → štvorec → úsečka → bod. Z bodu potom vyrastie úsečka,
   štvorec, kocka a **teserakt** (4D kocka); každý rozmer má svoju farbu.
   Teserakt sa otáča v štvrtom rozmere a nadrovina ho prereže: jeho 3D rezy
   sú sklenené telesá s plochami vo farbách buniek, ktoré rez pretína.
3. **Mandelbulb.** Teserakt sa zrúti do bodu, z neho sa za úsvitu zrodí
   farebný Mandelbulb (s každou dobou mu pribudne jedna iterácia), chvíľu
   „dýcha", a potom sa kamera ponorí k jeho povrchu, kde sa z fraktálu stane
   krajina — kaňony, terasy a oblúky v hmle.

Hudba (125 BPM) je zladená s obrazom: marimba stúpa so schodiskom, pri
rozoberaní budovy hrá skladba odzadu, arpeggio teseraktu má v takte toľko
tónov, koľko má útvar vrcholov (bod 1, úsečka 2, štvorec 4, kocka 8,
teserakt 16), a zrod Mandelbulbu sprevádza úder a stúpajúci tón na každú novú
iteráciu. Vo finále sa vráti prvá téma s melódiou.

| Súbor | Platforma | Veľkosť |
|---|---|---|
| [`dist/rozmery-windows.exe`](dist/rozmery-windows.exe) | Windows (32-bit exe, beží aj na 64-bit) | 5605 B |
| [`dist/rozmery-linux`](dist/rozmery-linux) | Linux x86-64 (glibc) | 6406 B |
| [`dist/rozmery-macos`](dist/rozmery-macos) | macOS 10.13+ na Intel Macu | 6584 B |

## Spustenie

Demo sa kedykoľvek ukončí klávesom **ESC** (na Linuxe a macOS ktoroukoľvek
klávesou), inak skončí samo po dohraní hudby. Beží na celej obrazovke v
natívnom rozlíšení a s neviditeľným kurzorom. Pri štarte sa počíta hudba (na
GPU, 3:12 stereo), preto je chvíľu čierna obrazovka.

Všetky tri verzie pri štarte zmerajú rýchlosť grafiky na najnáročnejšom
mieste dema (koniec ponoru do Mandelbulbu). Na slabšej grafike vykresľujú v
menšom rozlíšení, najmenej 11/16 obrazovky v každom smere, a obraz plynulo
zväčšia na celú obrazovku. Na výkonnej grafike bežia v plnom rozlíšení.
Animácia ide podľa času (podľa prehrávanej hudby), nie podľa počtu snímok,
takže nezávisí od obnovovacej frekvencie monitora.

### Windows

Stačí spustiť `rozmery-windows.exe`.

- Potrebné: grafika s OpenGL 3.3+, zvukové zariadenie a procesor s SSE4.2
  (požiadavka kompresora Crinkler 3.0).
- Na notebookoch s dvoma grafikami (NVIDIA Optimus, AMD) si demo vyžiada
  výkonnejšiu.
- Súbor je skomprimovaný demoscénickým linkerom Crinkler; niektoré antivírusy
  ho môžu mylne označiť ako podozrivý.

### Linux

```sh
chmod +x rozmery-linux
./rozmery-linux
```

- Obyčajná ELF binárka pre ľubovoľnú x86-64 distribúciu s glibc. Nič sa
  neinštaluje ani nezapisuje na disk.
- Potrebné: X11 alebo XWayland, OpenGL 4.1+ (s ovládačmi Mesa stačí 3.3),
  knižnica ALSA `libasound.so.2` (PipeWire/PulseAudio cez ňu fungujú),
  program `xzcat` a jadro 3.19+.
- Na notebookoch s dvoma grafikami: `DRI_PRIME=1 ./rozmery-linux` (Mesa) alebo
  `prime-run ./rozmery-linux` (NVIDIA).
- Prvých 236 bajtov súboru je malý ELF, ktorý zvyšok (LZMA) pošle cez
  `xzcat` do pamäťového súboru (`memfd`) a ten spustí — ten istý postup ako
  pri 4K intre BRÁNA.

### macOS (Intel)

```sh
chmod +x rozmery-macos
./rozmery-macos
```

- Krátky shell skript s pripojeným `tar` archívom (LZMA): rozbalí 20 KB
  binárku do `/tmp/a` a spustí ju.
- Potrebné: macOS 10.13+, OpenGL 3.2+ core profil, GLUT a AudioToolbox
  (súčasť macOS).

## Čo je vyskúšané

V cloudovom prostredí bez skutočnej grafickej karty (softvérové OpenGL Mesa
llvmpipe, virtuálne zvukové zariadenia):

- **Linux:** celé demo pod Xvfb s PipeWire. Nahratý zvuk je bit po bite
  zhodný s referenciou (okrem jedného výpadku nahrávania), obraz správny,
  ESC funguje, na llvmpipe si zvolí rozlíšenie 11/16.
- **macOS:** strojový kód macOS verzie spustený na Linuxe s náhradnými
  GLUT/OpenGL/AudioToolbox knižnicami (`../tools/macsim`): zvuk bit po bite
  zhodný, obraz správny. **Na skutočnom Macu zatiaľ nie.**
- **Windows:** Wine 9.0 s llvmpipe: zvuk zhodný s referenciou vzorka po vzorke
  (Wine pri plne vyťaženom procesore občas vynechá kúsok, to je vlastnosť
  testovacieho prostredia), obraz správny. **Na skutočných Windows zatiaľ
  nie.**
- Shadery v minifikovanej podobe vykresľujú presne to isté ako zdrojové
  (hudba aj snímky, aj v core profile ako na macOS) — `tools/check_shaders.sh`.

Na skutočných grafikách (NVIDIA, AMD, Intel) demo zatiaľ nebežalo. Shadery
dodržiavajú pravidlá, ktoré sa ukázali ako dôležité pri 4K intre na NVIDIA
(žiadne celé čísla v preťažených vstavaných funkciách, žiadne nedefinované
konštrukcie GLSL). Odhad podľa meraní 4K intra: na RTX 3060 v 2560 × 1440
okolo 20 ms na snímku v najnáročnejšom mieste.

## Ako je to urobené

- **Hudba:** fragment shader (`src/synth.frag`) raz pri štarte vypočíta
  všetkých 8 467 200 stereo vzoriek do float textúry (v 16 pásoch, aby slabé
  GPU nenarazili na watchdog), program ich prečíta a prehrá. Nástroje sú
  syntetizované (kick, hi-haty, clap, FM basa, pad zo „saw" vĺn, marimba,
  FM zvonček s ozvenou, melódia), časovanie je odvodené od celočíselného
  indexu vzorky.
- **Obraz:** jeden fragment shader (`src/scene.frag`) s raymarchingom.
  Budova je zložená z SDF prvkov, ktoré rastú podľa „hodín budovy" (tie pri
  rozoberaní bežia späť). Teserakt sa ráta analyticky: 16 vrcholov otočených
  v 4D a premietnutých perspektívou do 3D, hrany ako žiariace čiary, steny
  priesvitné; rez nadrovinou je konvexný mnohosten, ktorý sa pretína s lúčom
  presne (4 „pásy" v 4D). Mandelbulb má mocninu 8 a farby z orbit trapu; pri
  ponore sa výška kamery zmenšuje exponenciálne a tiene, AO aj hmla sa s ňou
  škálujú, takže na každej mierke je to krajina.
- **Platformy:** vrstvy pre Windows (C + Crinkler), Linux (ručne písaný ELF v
  NASM) a macOS (NASM + ld64.lld, dropper) sú prevzaté a upravené zo 4K intra
  BRÁNA v tomto repozitári; obsah dema (obraz aj hudba) je nový.

## Zostavenie

```sh
./build.sh
```

Nástroje sú tie isté ako pri 4K intre (`../README.md`): python3, glslang,
nasm, xz, tar, clang, lld, wine + Crinkler 3.0. Pre kontrolu shaderov treba X
server s OpenGL a `../tools/preview.c` skompilovaný do `$S/preview`. Skript
overí, že každý súbor v `dist/` má najviac 8192 bajtov. Technické poznámky
pre ďalšiu prácu sú v [`HANDOFF.md`](HANDOFF.md).
