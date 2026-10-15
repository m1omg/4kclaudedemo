Tri demá, každé pre **Windows**, **Linux** a **macOS (Intel)**. Všetko (3D grafiku aj hudbu) vypočítajú počas behu.

| Demo | Limit | Windows | Linux | macOS | Dĺžka |
|---|---|---|---|---|---|
| **BRÁNA** (`brana-4k.zip`) | 4096 B | 3680 B | 4090 B | 4048 B | 2:26 |
| **ROZMERY 4K** (`rozmery-4k.zip`) | 4096 B | 3681 B | 4084 B | 4035 B | 3:20 |
| **ROZMERY** 8K (`rozmery-8k.zip`) | 8192 B | 6498 B | 7413 B | 7573 B | 3:20 |

Každý zip obsahuje všetky tri verzie dema; jednotlivé súbory sú priložené aj samostatne. Zip zachová spustiteľné práva pre Linux a macOS.

Ukončenie: ESC (na Linuxe a macOS ktorákoľvek klávesa). Pri štarte je chvíľu čierna obrazovka, počíta sa hudba.

**Čo je vyskúšané**
- **BRÁNA:** Linux na skutočnom PC s NVIDIA RTX 3060 (hudba aj obraz fungujú). macOS na Macbooku s Intel HD Graphics funguje, ale len pri niekoľkých snímkach za sekundu (staršia verzia; novšie optimalizácie tam ešte vyskúšané nie sú). Windows len pod Wine.
- **ROZMERY 4K a ROZMERY 8K:** len v cloudovom prostredí so softvérovým OpenGL (Mesa llvmpipe): Linux pod Xvfb, Windows pod Wine, macOS v simulácii. Na skutočnej grafike, Windows ani Macu zatiaľ nebežali.

Podrobnosti: `README.md`, `rozmery4k/README.md`, `8k/README.md`.
