# ROZMERY — 8K demo

**ROZMERY** je 8K demo pre **Windows**, **Linux** a **macOS (Intel)**. Každá
verzia je jeden spustiteľný súbor s veľkosťou **do 8192 bajtov**, ktorý počas
behu vypočíta všetko — 3D grafiku aj hudbu. Demo trvá **3:20**.

1. **Budova sa postaví sama.** Najprv sa na zemi nakreslí jej pôdorys ako
   modrotlač, potom z námestia vyrastie základová doska, stĺpy rastú poschodie
   po poschodí, stropné dosky sa vysúvajú z jadra, schodisko pribúda po jednom
   schode na každú dobu hudby, fasáda dostane stĺpiky a sklá, nakoniec atika,
   strojovňa a stožiar. Zapadne slnko a v oknách sa rozsvieti.
2. **Prechod do 4D.** Okolo budovy sa rozžiari jej obrys a budova sa plynulo
   rozoberie, akoby sa čas vracal (najprv pomaly, potom rýchlejšie a na konci
   zas pomaly). Obrys sa zrúti: kocka → štvorec → úsečka → bod. Z bodu potom
   vyrastie úsečka, štvorec, kocka a **teserakt** (4D kocka); každý rozmer má
   svoju farbu. Celý prechod je jeden plynulý pohyb kamery, bez strihu.
   Teserakt sa otáča v štvrtom rozmere a nadrovina ho prereže: jeho 3D rezy
   sú sklenené telesá s plochami vo farbách buniek, ktoré rez pretína.
3. **Mandelbulb.** Teserakt sa zrúti do bodu, z neho sa za úsvitu zrodí
   farebný Mandelbulb (s každou dobou mu pribudne jedna iterácia) a chvíľu
   „dýcha". Potom sa kamera bez strihu ponorí do toho istého Mandelbulbu,
   preletí ponad hrebeň na „hrádzu" pozdĺž jeho rovníka a nízko a rýchlo
   letí krajinou fraktálu: z hrádze odbočí do lesa púčikov, kľukatí sa
   pomedzi veže proti slnku, zletí do údolia, vystúpa po stene obrovského
   útvaru a preletí ponad jeho farebný vrchol. Klesá do údolí, stúpa ponad
   vyvýšeniny a v zákrutách sa nakláňa. Nakoniec vystúpi, vzdiali sa a
   ukáže celý Mandelbulb.

Hudba je **synthwave** (125 BPM): snare s „gated reverb" ako v 80. rokoch,
oktávová saw basa pulzujúca s kickom, elektronické tomy na konci fráz, šestnástinové
arpeggiá s ozvenou, plné pady a hlavná melódia na rozladených saw syntezátoroch.
Je zladená s obrazom: zvonček stúpa so schodiskom (tón na každý schod), pri
rozoberaní budovy sa pad nadýchne, šum sleduje rýchlosť rozoberania a arpeggio
beží odzadu; obrys sa zrúti na tri hlboké údery. Arpeggio teseraktu má v takte
toľko tónov, koľko má útvar vrcholov (úsečka 2, štvorec 4, kocka 8, teserakt
16). Zrod Mandelbulbu sprevádza úder a tón na každú novú iteráciu, let krajinou
Mandelbulbu nesie hlavnú melódiu (druhýkrát aj o oktávu vyššie) a demo končí
akordom Cmaj7.

| Súbor | Platforma | Veľkosť |
|---|---|---|
| [`dist/rozmery-windows.exe`](dist/rozmery-windows.exe) | Windows (32-bit exe, beží aj na 64-bit) | 6498 B |
| [`dist/rozmery-linux`](dist/rozmery-linux) | Linux x86-64 (glibc) | 7413 B |
| [`dist/rozmery-macos`](dist/rozmery-macos) | macOS 10.13+ na Intel Macu | 7573 B |

### Zmeny v tejto verzii

- Na výkonnej grafike je budova ostrejšia: keď demo beží v plnom rozlíšení,
  každý pixel sa v prvej časti počíta zo 4 vzoriek (supersampling), takže
  hrany budovy, stĺpikov a schodiska nie sú zubaté a pri pohybe kamery sa
  nemihocú. Platí to od začiatku po strih v 46. takte (budova, jej rozobratie
  a zrod teseraktu), tam sa zmena nedá postrehnúť. Podľa meraní sú takéto
  snímky stále rýchlejšie než najnáročnejšie miesto letu. Slabšia grafika,
  ktorá kreslí v menšom rozlíšení, ostáva bez zmeny.

### Predchádzajúce verzie

- Let nad Mandelbulbom už nejde rovno po hrádzi, kde krásne útvary zostávali
  len po bokoch. Trasa sa kľukatí priamo pomedzi ne — les púčikov, veže,
  údolie a výstup ponad obrovský útvar; kamera klesá do údolí, stúpa ponad
  vyvýšeniny a v zákrutách sa nakláňa. Trasu som navrhol podľa mapy povrchu
  Mandelbulbu, výška letu sleduje terén tesne nad ním (`tools/flypath.py`).
- Rýchlosť grafiky sa pri štarte meria v novom najnáročnejšom mieste dema
  (v údolí počas letu).
- Opravená chyba vykresľovania budovy: svetelné šmuhy a „duchovia" schodov v
  jej tieni na námestí (lúče tieňov končili príliš skoro) a drobné bodky na
  fasáde a pri základni (odhad vzdialenosti v niektorých miestach prestrelil:
  ohraničujúci kváder nepokrýval okraj základovej dosky, vyhodnocovala sa len
  najbližšia stropná doska a len jedno rameno schodiska). Schodisko teraz
  stojí na základovej doske.
- Plynulý prechod z budovy do 4D (bez strihu a bez prehrávania hudby odzadu).
- Kamera sa ponorí do toho istého Mandelbulbu, ktorý predtým ukazuje; let nad
  krajinou je nižšie, rýchlejší a dlhší, s pristátím a odletom.
- Nová hudba v štýle synthwave, rozmanitejšia a živšia; demo je o 8 sekúnd
  dlhšie.

## Spustenie

Demo sa kedykoľvek ukončí klávesom **ESC** (na Linuxe a macOS ktoroukoľvek
klávesou), inak skončí samo po dohraní hudby. Beží na celej obrazovke v
natívnom rozlíšení a s neviditeľným kurzorom. Pri štarte sa počíta hudba (na
GPU, 3:20 stereo), preto je chvíľu čierna obrazovka.

Všetky tri verzie pri štarte zmerajú rýchlosť grafiky na najnáročnejšom
mieste dema (údolie počas letu nad Mandelbulbom). Na slabšej grafike
vykresľujú v menšom rozlíšení, najmenej 11/16 obrazovky v každom smere, a
obraz plynulo zväčšia na celú obrazovku. Na výkonnej grafike bežia v plnom
rozlíšení a budovu kreslia so 4 vzorkami na pixel (vyhladené hrany).
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

- **Linux:** celé demo pod Xvfb s PipeWire. Nahratý zvuk je v celej dĺžke
  bit po bite zhodný s referenciou, obraz správny, ESC funguje, na llvmpipe si
  zvolí rozlíšenie 11/16.
- **macOS:** strojový kód macOS verzie spustený na Linuxe s náhradnými
  GLUT/OpenGL/AudioToolbox knižnicami (`../tools/macsim`): zvuk v celej dĺžke
  bit po bite zhodný, obraz správny. **Na skutočnom Macu zatiaľ nie.**
- **Windows:** Wine 9.0 s llvmpipe: zvuk je vzorka po vzorke zhodný s
  referenciou (32 z 33 kontrolovaných úsekov; v zvyšnom Wine pri plne
  vyťaženom procesore vynechal kúsok, to je vlastnosť testovacieho
  prostredia), obraz správny.
  **Na skutočných Windows zatiaľ nie.**
- Shadery v minifikovanej podobe vykresľujú presne to isté ako zdrojové
  (hudba aj snímky) — `tools/check_shaders.sh`. V core profile (ako na macOS)
  sa pri lete nad Mandelbulbom líšia tenké farebné hranice fraktálu (pod 0,1 %
  pixelov), to je presnosť výpočtov, nie chyba.
- Kamera sa pri lete nikdy nedotkne povrchu fraktálu a otáča sa plynulo, bez
  trhnutí: dráha aj natočenie kamery sú overené výpočtom v plnej presnosti
  (`tools/flypath.py`).
- Vyhladzovanie budovy (4 vzorky na pixel) sa v testovacom prostredí samo
  nezapne, lebo llvmpipe je príliš pomalé. Overil som ho na testovacích
  verziách, ktoré si plné rozlíšenie vynútia: Linux aj Windows (Wine) vykreslia snímku presne rovnako ako
  náhľad s vyhladzovaním, macOS (macsim) ho zapne a beží správne.

Na skutočných grafikách (NVIDIA, AMD, Intel) demo zatiaľ nebežalo. Shadery
dodržiavajú pravidlá, ktoré sa ukázali ako dôležité pri 4K intre na NVIDIA
(žiadne celé čísla v preťažených vstavaných funkciách, žiadne nedefinované
konštrukcie GLSL). Odhad podľa meraní 4K intra: na RTX 3060 v 2560 × 1440
okolo 15,5 ms na snímku v najnáročnejšom mieste (údolie počas letu).

## Ako je to urobené

- **Hudba:** fragment shader (`src/synth.frag`) raz pri štarte vypočíta
  všetkých 8 805 888 stereo vzoriek do float textúry (v 16 pásoch, aby slabé
  GPU nenarazili na watchdog), program ich prečíta a prehrá. Všetky nástroje
  sú syntetizované (kick, gated snare, hi-haty, tomy, saw basa so sub-basom,
  pad, arpeggio, zvonček, melódia s vibratom a ozvenou), časovanie je
  odvodené od celočíselného indexu vzorky.
- **Obraz:** jeden fragment shader (`src/scene.frag`) s raymarchingom.
  Budova je zložená z SDF prvkov, ktoré rastú podľa „hodín budovy" (tie pri
  rozoberaní bežia späť). Teserakt sa ráta analyticky: 16 vrcholov otočených
  v 4D a premietnutých perspektívou do 3D, hrany ako žiariace čiary, steny
  priesvitné; rez nadrovinou je konvexný mnohosten, ktorý sa pretína s lúčom
  presne (4 „pásy" v 4D). Mandelbulb má mocninu 8 a farby z orbit trapu.
  Na rýchlej grafike sa prvá časť dema počíta so 4 vzorkami na pixel v
  pootočenej mriežke a ich výsledné farby sa spriemerujú (ako keby sa obraz
  vykreslil v dvojnásobnom rozlíšení a zmenšil).
  Dráhu letu som navrhol podľa mapy výšky jeho povrchu: trasa vedie cez body
  vybrané na mape, výška letu je vyhladený terén pod trasou plus malá výška
  (kamera začne stúpať ešte pred kopcom). Kamera hľadí dopredu po trase a v
  zákrutách sa nakláňa podľa ich zakrivenia, smer „hore" a obloha sa riadia
  povrchom pod ňou a tiene, AO aj hmla sa škálujú s mierkou letu, takže na
  každej mierke je to krajina.
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
