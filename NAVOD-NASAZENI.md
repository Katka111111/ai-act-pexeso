# Návod: jak spustit hru AI Act Pexeso na internetu

**Krok 1 a 2 (GitHub + GitHub Pages) už jsou hotové.** Hra teď má dvě
samostatné části:

**SOUTĚŽ** (živá vícekolová hra s žebříčkem, řídí ji lektorka na plátně):
- Pro hráče: **https://katka111111.github.io/ai-act-pexeso/**
- Pro lektorku/plátno: **https://katka111111.github.io/ai-act-pexeso/board.html**

**TEST** (samostatné, nekonečné procvičování bez lektorky a bez jména -
kdokoliv s odkazem si může kdykoliv zahrát, 7 náhodných dvojic, a hned
po dohrání si vylosovat další kolo, dokud sám neklikne na "Chci odejít"):
- **https://katka111111.github.io/ai-act-pexeso/test.html**

Zdrojový kód: https://github.com/Katka111111/ai-act-pexeso

QR kód na SOUTĚŽ je už i v prezentaci (poslední slidy). Pokud budeš chtít
i živý sdílený žebříček mezi hráči v soutěžním režimu, pokračuj kroky 3-5
níže (Firebase) - zatím soutěž běží v tzv. "lokálním režimu" (funguje, jen
bez sdíleného žebříčku mezi zařízeními). TEST žádnou Firebase nepotřebuje -
funguje vždy, i bez kroků 3-5.

**Slovní mrak (icebreaker aktivita) je teď v samostatném repozitáři**, aby
tento repozitář obsahoval jen hru:
- Zdrojový kód a vlastní návod: https://github.com/Katka111111/wordcloud
- Pro účastníky: **https://katka111111.github.io/wordcloud/**
- Pro lektorku/plátno: **https://katka111111.github.io/wordcloud/board.html**

Sdílí se stejný Firebase projekt jako tahle hra (jen jiná "část" databáze),
takže žádné další zakládání účtů navíc.

---

Tento návod je pro úplného začátečníka. Nebudeš potřebovat žádnou příkazovou
řádku ani programování - všechno se dělá klikáním myší v internetovém
prohlížeči (Chrome, Edge apod.).

Hra funguje i BEZ kroků 3-5 (Firebase) - jen v takovém případě nebude
fungovat živý žebříček mezi více hráči (v soutěžním režimu), hra se přepne
do tzv. "lokálního režimu" a každé zařízení si žebříček počítá jen samo
pro sebe. Pokud ti to pro školení stačí, kroky 3-5 klidně přeskoč.

---

## Co je co (pár pojmů předem)

- **GitHub** = bezplatná služba, kam nahraješ soubory hry, a ona z nich
  udělá fungující webovou stránku, kterou vidí kdokoli s odkazem.
- **GitHub Pages** = funkce GitHubu, která soubory "zpřístupní" jako
  webovou stránku (jinak by to byla jen složka se soubory).
- **Firebase** = bezplatná služba od Googlu, která umí "za běhu" ukládat
  a sdílet malá data mezi hráči (potřebné pro živý žebříček v soutěži).
- **Repozitář (repository)** = na GitHubu jen jiné slovo pro "složku
  projektu".

---

## Krok 1: Založení účtu na GitHubu

1. Jdi na stránku **https://github.com**
2. Klikni na **Sign up** (Registrovat se) vpravo nahoře.
3. Zadej e-mail, heslo a zvol si uživatelské jméno. Postupuj podle pokynů
   na obrazovce (ověření e-mailu apod.).
4. Po dokončení se přihlas.

## Krok 2: Nahrání souborů hry a zapnutí GitHub Pages

1. Po přihlášení klikni vpravo nahoře na **+** a poté na
   **New repository** (Nový repozitář).
2. Do pole **Repository name** napiš například `ai-act-pexeso`.
3. Nastav repozitář jako **Public** (Veřejný) - jinak by GitHub Pages
   nefungovaly zdarma.
4. Klikni na **Create repository**.
5. Na další stránce klikni na odkaz **uploading an existing file**
   (nahrát existující soubor).
6. Otevři na svém počítači složku
   `C:\Users\admin\Documents\skoleni-ai-act\ai-act-pexeso\` a přetáhni
   myší VŠECHNY soubory a podsložky (`index.html`, `board.html`,
   `css`, `js`, `assets`, `firebase-rules.json`...) do okna prohlížeče,
   kam GitHub vyzývá "Drag files here".
7. Počkej, až se nahrání dokončí, a dole klikni na zelené tlačítko
   **Commit changes** (Uložit změny).
8. Nahoře v repozitáři klikni na záložku **Settings** (Nastavení).
9. V levém menu klikni na **Pages**.
10. V sekci **Build and deployment** → **Branch** vyber `main` a
    složku `/ (root)`, pak klikni **Save**.
11. Počkej cca 1-2 minuty a obnov stránku (F5). Nahoře se objeví zelená
    hláška s adresou tvé hry, něco jako:

    `https://tve-uzivatelske-jmeno.github.io/ai-act-pexeso/`

12. Tuto adresu si ulož - je to hlavní odkaz na hru pro hráče
    (otevřou si `index.html`, ten se otevře automaticky). Adresa pro
    lektorku/plátno bude stejná jen s `board.html` na konci, např.:

    `https://tve-uzivatelske-jmeno.github.io/ai-act-pexeso/board.html`

**Hra teď už funguje** (v lokálním režimu žebříčku). Pokud chceš i živý
sdílený žebříček mezi hráči v soutěži, pokračuj kroky 3-5.

---

## Krok 3: Založení Firebase projektu (pro živý žebříček)

1. Jdi na **https://console.firebase.google.com**
2. Přihlas se svým Google účtem (Gmail).
3. Klikni na **Add project / Vytvořit projekt**.
4. Zadej název projektu, např. `ai-act-pexeso`, klikni **Continue**
   (Pokračovat) a dokonči průvodce (Google Analytics můžeš vypnout,
   není potřeba). Klikni **Create project**.
5. V levém menu klikni na **Build** → **Realtime Database**.
6. Klikni na **Create Database** (Vytvořit databázi).
7. Vyber lokaci (klidně ponech výchozí) a klikni **Next**.
8. U pravidel zabezpečení zvol **Start in test mode** (dočasně - pravidla
   nahradíme v kroku 4) a klikni **Enable**.
9. Po vytvoření uvidíš nahoře adresu databáze, něco jako:

   `https://ai-act-pexeso-xxxxx-default-rtdb.europe-west1.firebasedatabase.app`

   Tuto adresu si zkopíruj - budeš ji potřebovat v kroku 5.

## Krok 4: Vložení bezpečnostních pravidel

1. V Realtime Database klikni nahoře na záložku **Rules** (Pravidla).
2. Smaž obsah pole a nahraď ho celým obsahem souboru
   `firebase-rules.json` z projektu (otevři si ho v poznámkovém bloku,
   označ vše (Ctrl+A), zkopíruj (Ctrl+C) a vlož (Ctrl+V) do Firebase).
3. Klikni na **Publish** (Publikovat).

Tato pravidla povolují čtení a zápis jen do části `/sessions` (kde hra
ukládá výsledky) a hlídají, že se tam neukládají nesmyslná nebo příliš
dlouhá data. Nevyžadují přihlašování hráčů ani žádné citlivé údaje.

## Krok 5: Vyplnění adresy Firebase do hry

1. Otevři soubor `js/config.js` (např. přes GitHub - klikni na soubor
   v repozitáři a pak na ikonu tužky "Edit").
2. Najdi řádek:

   `const FIREBASE_URL = "NASTAVTE_ZDE";`

3. Nahraď `NASTAVTE_ZDE` adresou z kroku 3 (tou, co končí na
   `firebasedatabase.app`), např.:

   `const FIREBASE_URL = "https://ai-act-pexeso-xxxxx-default-rtdb.europe-west1.firebasedatabase.app";`

4. Ulož změnu (na GitHubu dole klikni **Commit changes**).
5. Po cca minutě se změna projeví i na živé stránce hry (GitHub Pages
   se automaticky aktualizují).

Od této chvíle bude soutěžní režim ukládat výsledky do Firebase a
všichni hráči i plátno lektorky uvidí stejný živý žebříček.

---

## Krok 6: Vygenerování QR kódu pro hráče

Postupuj podle souboru `assets/jak-vygenerovat-qr.txt` - stručně: otevři
speciální webovou adresu s adresou tvé hry, stáhni obrázek QR kódu a ulož
ho jako `assets/qr-kod.png`. Hráči ho pak jen naskenují mobilem.

---

## Jak hru spustit v den školení

1. Ty (lektorka) otevři na svém počítači/promítacím zařízení
   `board.html` (adresu z kroku 2, s `board.html` na konci).
2. Zvol režim **Test** nebo **Soutěž** kliknutím na tlačítko - tím se
   volba pošle všem připojeným hráčům.
3. Účastníci otevřou `index.html` (přes QR kód nebo odkaz), zadají
   přezdívku a hra se podle tvé volby sama spustí.
4. V režimu Soutěž sleduješ na `board.html` živý žebříček po kolech a po
   3. kole klikneš na **Zobrazit celkové výsledky**.

## Poznámka k datu / opakování školení

Hra si datum bere automaticky (dnešní den = "session"). Pokud školení
proběhne jiný den, spustí se automaticky nové losování z celé banky 60
dvojic - nemusíš nic ručně resetovat.
