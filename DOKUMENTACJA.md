# Pomiary Wysiłkowe — dokumentacja

Aplikacja do codziennego monitorowania obciążenia treningowego, regeneracji i gotowości zawodnika.
Zawodnik wypełnia jeden wpis dziennie, a wuefista (administrator) przegląda wyniki wszystkich osób
w komórkach organizacyjnych.

Spis treści:

1. [Jak działa aplikacja](#1-jak-działa-aplikacja)
2. [Architektura](#2-architektura)
3. [Mierzone parametry](#3-mierzone-parametry)
4. [Baza danych](#4-baza-danych)
5. [REST API](#5-rest-api)
6. [Frontend — gdzie co jest](#6-frontend--gdzie-co-jest)
7. [Uruchomienie](#7-uruchomienie)
8. [Obsługa aplikacji](#8-obsługa-aplikacji)
9. [Aplikacje na telefon](#9-aplikacje-na-telefon)
10. [Rozwiązywanie problemów](#10-rozwiązywanie-problemów)
11. [Ograniczenia i możliwe kolejne kroki](#11-ograniczenia-i-możliwe-kolejne-kroki)

---

## 1. Jak działa aplikacja

### Role

| Rola | Jak rozpoznawana | Co widzi |
|---|---|---|
| **user** (zawodnik) | każdy pseudonim poza adminem | swój dzienny wpis i swój wykres |
| **admin** (wuefista) | kolumna `Rola = 'admin'` w tabeli `Uzytkownicy`, domyślnie pseudonim `wuefista` | wszystkie komórki, osoby, ich wpisy i wykresy |

### Logowanie

Nie ma haseł ani rejestracji. Użytkownik podaje **pseudonim** i wybiera **komórkę organizacyjną**:

- pseudonim nieznany bazie → zakładane jest nowe konto z rolą `user` w wybranej komórce,
- pseudonim znany → wybór komórki jest ignorowany, logowanie następuje na istniejące konto,
- konto z rolą `admin` trafia do panelu wuefisty zamiast do formularza.

Po zalogowaniu urządzenie **zapamiętuje użytkownika na stałe** (`localStorage`, klucz `pw_user`),
więc ekran logowania nie pojawia się ponownie aż do kliknięcia „Wyloguj”. Przy starcie aplikacja
odpytuje API o aktualne dane konta: jeśli konto zniknęło z bazy albo zmieniła się rola,
użytkownik jest wylogowywany. Brak sieci nie wylogowuje.

Pseudonim i komórka z ostatniego logowania zostają w `localStorage` (klucz `pw_ostatni`) i są
podpowiadane w formularzu po wylogowaniu.

### Zasada „jeden wpis dziennie”

Każdy użytkownik ma maksymalnie **jeden wpis na dzień kalendarzowy**:

- pierwszy zapis danego dnia tworzy wpis,
- kolejny zapis **nadpisuje** ten sam rekord i aktualizuje godzinę (`Nadpisany: true` w odpowiedzi API),
- pilnuje tego serwer w transakcji, więc zapis z dwóch urządzeń naraz nie utworzy duplikatu,
- ewentualne starsze duplikaty z tego samego dnia są przy zapisie usuwane.

Po wejściu na stronę formularz jest wypełniany dzisiejszym wpisem, jeśli taki istnieje.

### Uprawnienia do usuwania

Wpis może usunąć jego właściciel albo użytkownik z rolą `admin`. Sprawdza to serwer
(`DELETE /api/pomiary/:id?uzytkownikId=...`), a nie tylko interfejs.

---

## 2. Architektura

```
┌────────────────────────────┐     HTTP/JSON      ┌──────────────────────┐     ODBC      ┌──────────────┐
│  Angular 22 + Ionic 9      │ ─────────────────► │  Node.js + Express 5 │ ────────────► │  SQL Server  │
│  przeglądarka / iOS /      │                    │  wf-api/server.js    │  msnodesqlv8  │  PomiaryDB   │
│  Android (Capacitor 8)     │ ◄───────────────── │  port 3000           │ ◄──────────── │              │
└────────────────────────────┘                    └──────────────────────┘               └──────────────┘
```

- **Frontend**: Angular 22 (komponenty standalone, sygnały, zoneless), Ionic 9 (wygląd i komponenty
  mobilne), Chart.js 4 przez ng2-charts (wykresy).
- **API**: Node.js 24, Express 5, sterownik `msnodesqlv8` (logowanie Windows do SQL Server).
- **Baza**: SQL Server, instancja `localhost\MSSQLSERVER04`, baza `PomiaryDB`.
- Serwer API udostępnia też **zbudowany frontend**, więc cała aplikacja działa pod jednym adresem
  (`http://localhost:3000`). Dzięki temu telefon nie potrzebuje drugiego serwera.
- **Uwierzytelnianie**: brak. Tożsamość to sam pseudonim. Do projektu uczelnianego to wystarcza,
  ale każdy, kto zna pseudonim wuefisty, zobaczy dane wszystkich.

---

## 3. Mierzone parametry

Definicje w jednym miejscu: [`src/app/parametry.ts`](src/app/parametry.ts) (frontend) oraz tablica
`ZAKRESY` w [`wf-api/server.js`](wf-api/server.js) (walidacja serwera). Zmiana parametru wymaga
poprawki w obu plikach i w tabeli `Pomiary`.

### Wprowadzane przez użytkownika

| # | Parametr | Pole API | Kolumna | Zakres | Jednostka | Jak wprowadzane |
|---|---|---|---|---|---|---|
| 1 | Czas treningu | `czasTreningu` | `CzasTreningu` | 0–1440 | minuty | pole liczbowe + przełącznik **h/min** |
| 2 | RPE treningu | `rpeTreningu` | `RpeTreningu` | 0–10 | pkt | 11 przycisków, skala Borga CR-10 |
| 3 | Czas pracy | `czasPracy` | `CzasPracy` | 0–1440 | minuty | jak wyżej, domyślnie w godzinach |
| 4 | RPE pracy | `rpePracy` | `RpePracy` | 0–10 | pkt | 11 przycisków |
| 5 | Tętno po przebudzeniu | `tetnoPoranne` | `TetnoPoranne` | 20–120 | ud./min | pole liczbowe |
| 6 | Ilość snu | `sen` | `Sen` | 0–12, krok 0,25 | godziny | pole liczbowe (krok 15 min) |
| 7 | Chęć do treningu | `checDoTreningu` | `ChecDoTreningu` | 1–5 | pkt | 5 buziek 😖 🙁 😐 🙂 😄 |
| 8 | Tapping test | `tapping` | `Tapping` | 0–500 | stuknięcia | test 10 s w aplikacji |

Wszystkie pola są opcjonalne, ale zapis wymaga **co najmniej jednej wartości**. Puste pola trafiają
do bazy jako `NULL`.

### Wyliczane automatycznie (metoda sRPE)

| # | Wskaźnik | Kolumna | Wzór | Jednostka |
|---|---|---|---|---|
| 9 | Obciążenie treningowe | `ObciazenieTreningowe` | `CzasTreningu × RpeTreningu` | AU |
| 10 | Obciążenie pracą | `ObciazeniePraca` | `CzasPracy × RpePracy` | AU |

Liczy je **baza danych** jako kolumny wyliczane `PERSISTED`, więc:

- nie da się ich wpisać ani nadpisać przez API,
- po zmianie czasu albo RPE przeliczają się same,
- gdy brakuje któregoś składnika, wynik to `NULL`, a nie `0`.

Formularz pokazuje podgląd obciążenia na żywo, jeszcze przed zapisem.

### Skale opisowe

- **RPE (Borg CR-10)**: 0 brak wysiłku, 3 lekki, 4 umiarkowany, 6 ciężki, 7 bardzo ciężki,
  10 maksymalny. Pełna lista w stałej `RPE_OPISY`.
- **Chęć do treningu**: 1 bardzo niechętnie … 5 bardzo chętnie (stała `BUZKI`).

### Walidacja

Te same reguły działają w przeglądarce (natychmiastowy komunikat) i na serwerze (odrzucenie zapisu):

1. zakres każdego parametru,
2. liczba całkowita, a dla snu wielokrotność 0,25 h,
3. **suma czasu treningu i pracy ≤ 1440 min** (doba) — walidacja krzyżowa,
4. dodatkowo baza ma własne ograniczenia `CHECK`, więc błędne dane nie wejdą też poza aplikacją.

---

## 4. Baza danych

Instancja `localhost\MSSQLSERVER04`, baza `PomiaryDB`, logowanie Windows (bez konta `sa`).

### Tabele

**`Komorki`** — komórki organizacyjne (10 sztuk: Kadra, Pluton 1–9)

| Kolumna | Typ |
|---|---|
| `Id` | int, klucz główny |
| `Nazwa` | nvarchar(100) |

**`Uzytkownicy`**

| Kolumna | Typ | Uwagi |
|---|---|---|
| `Id` | int, klucz główny | |
| `Pseudonim` | nvarchar(50), unikalny | identyfikuje osobę przy logowaniu |
| `KomorkaId` | int, null | `NULL` u admina |
| `Rola` | nvarchar(10) | `user` albo `admin` |

**`Pomiary`** — dzienne wpisy

| Kolumna | Typ | Ograniczenie |
|---|---|---|
| `Id` | int, klucz główny | |
| `UzytkownikId` | int | klucz obcy do `Uzytkownicy` |
| `Data` | datetime | domyślnie `GETDATE()` |
| `CzasTreningu` | int, null | 0–1440 |
| `RpeTreningu` | int, null | 0–10 |
| `CzasPracy` | int, null | 0–1440 |
| `RpePracy` | int, null | 0–10 |
| `TetnoPoranne` | int, null | 20–120 |
| `Sen` | decimal(4,2), null | 0–12 |
| `ChecDoTreningu` | int, null | 1–5 |
| `Tapping` | int, null | 0–500 |
| `ObciazenieTreningowe` | int, **wyliczana** | `CzasTreningu * RpeTreningu` |
| `ObciazeniePraca` | int, **wyliczana** | `CzasPracy * RpePracy` |

Dodatkowo ograniczenie `CK_Pomiary_DobaMax`: `ISNULL(CzasTreningu,0) + ISNULL(CzasPracy,0) <= 1440`
oraz indeks `IX_Pomiary_Uzytkownik_Data` przyspieszający odczyt wpisów jednej osoby.

**`PomiaryArchiwum`** — stare pomiary z poprzedniego zestawu parametrów (tętno spoczynkowe i po
wysiłku, ciśnienie, SpO₂, czas, RPE 6–20). Tabela jest tylko do odczytu: aplikacja jej nie używa,
dane zostały zachowane na wypadek potrzeby porównań. Można je obejrzeć w SSMS albo przez `sqlcmd`.

### Skrypty (`wf-api/db/`)

| Plik | Do czego |
|---|---|
| `komorki.sql` | dodaje komórki do łącznie 10 (idempotentny) |
| `migracja-nowe-parametry.sql` | przenosi stare pomiary do `PomiaryArchiwum` i tworzy nową tabelę `Pomiary`; uruchomiony drugi raz nic nie robi |
| `przyklad.sql` | tworzy dane przykładowe: 40 osób w 10 komórkach, wpisy z 90 dni; kasuje wcześniejsze dane przykładowe |
| `przyklad_usun.sql` | usuwa dane przykładowe (konta z wpisami w archiwum zostają) |

Uruchamianie (uwaga na `-f 65001`, bez tego psują się polskie znaki):

```bash
sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/przyklad.sql
```

Stan bazy w chwili pisania dokumentacji: 10 komórek, 45 użytkowników, 2224 wpisy, 1689 rekordów w archiwum.

---

## 5. REST API

Serwer: [`wf-api/server.js`](wf-api/server.js), port 3000, prefiks `/api`.
Dokumentacja interaktywna: **http://localhost:3000/api-docs** (Swagger UI),
specyfikacja: [`wf-api/openapi.yaml`](wf-api/openapi.yaml) oraz `http://localhost:3000/openapi.json`.

| Metoda | Adres | Opis |
|---|---|---|
| GET | `/api/komorki` | komórki z liczbą osób |
| GET | `/api/komorki/:id/uzytkownicy` | osoby w komórce, liczba wpisów, data ostatniego |
| POST | `/api/login` | `{pseudonim, komorkaId}` → użytkownik; tworzy konto, jeśli nie istnieje |
| GET | `/api/uzytkownicy/:id` | dane użytkownika wraz z nazwą komórki |
| GET | `/api/pomiary/:userId` | wszystkie wpisy użytkownika, rosnąco po dacie |
| POST | `/api/pomiary` | zapis dzisiejszego wpisu (tworzy albo nadpisuje) |
| DELETE | `/api/pomiary/:id?uzytkownikId=` | usunięcie wpisu (właściciel albo admin) |

Przykład zapisu:

```bash
curl -X POST http://localhost:3000/api/pomiary -H "Content-Type: application/json" -d "{\"uzytkownikId\":5,\"czasTreningu\":75,\"rpeTreningu\":7,\"sen\":7.25}"
```

Odpowiedź zawiera wyliczone obciążenia i informację, czy wpis został nadpisany:

```json
{ "Id": 2224, "CzasTreningu": 75, "RpeTreningu": 7, "ObciazenieTreningowe": 525, "Nadpisany": false }
```

Błędy mają postać `{"error": "opis"}` i status 400 (błędne dane), 403 (brak uprawnień) albo 404.
Przykłady komunikatów: `RPE treningu: dozwolony zakres 0–10.`,
`Ilość snu (h): dozwolony krok co 0.25.`, `Czas treningu i pracy razem to 1500 min, a doba ma 1440 min.`

Inne elementy serwera:

- **CORS** otwarty dla wszystkich źródeł (potrzebny aplikacjom mobilnym).
- **Dziennik ruchu**: każde zapytanie do `/api` wypisuje w konsoli godzinę, urządzenie
  (iPhone / Android / przeglądarka), operację, status i czas odpowiedzi.
- **Serwowanie frontendu**: jeśli istnieje `dist/apkaWF/browser`, serwer oddaje pliki aplikacji,
  a nieznane ścieżki kieruje do `index.html` (routing Angulara).
- Przy starcie wypisuje adresy w sieci lokalnej do otwarcia na telefonie.

---

## 6. Frontend — gdzie co jest

```
src/app/
├── app.config.ts          providery: router, HttpClient, Ionic, język polski, nagłówek ngroka
├── app.routes.ts          trasy i przypisane do nich strażniki
├── app.ts / app.html      korzeń aplikacji (ion-app + ion-router-outlet)
├── config.ts              adres API (osobny dla aplikacji natywnej)
├── guards.ts              authGuard, adminGuard, goscGuard
├── parametry.ts           definicje parametrów, skale RPE i buziek, czas tappingu
├── services/api.service.ts   wszystkie wywołania HTTP + zapamiętany użytkownik
└── pages/
    ├── login/             pseudonim + komórka
    ├── pomiary/           dzienny wpis (największy plik w projekcie)
    ├── wykres/            wykres liniowy z zakresami czasu
    └── admin/             panel wuefisty
```

### Trasy

| Ścieżka | Strona | Strażnik |
|---|---|---|
| `/login` | logowanie | `goscGuard` — zalogowanego przekierowuje dalej |
| `/pomiary` | dzienny wpis | `authGuard` |
| `/wykres/:userId` | wykres osoby | `authGuard` + kontrola w komponencie (zwykły użytkownik widzi tylko siebie) |
| `/admin` | panel wuefisty | `adminGuard` |

Strony są ładowane leniwie (`loadComponent`), a Chart.js dołącza się dopiero przy wejściu na wykres.

### Kluczowe pliki przy typowych zmianach

| Chcę zmienić | Plik |
|---|---|
| zakres, nazwę, jednostkę, kolor parametru | `src/app/parametry.ts` **oraz** `ZAKRESY` w `wf-api/server.js` **oraz** kolumnę w bazie |
| wygląd formularza dziennego | `src/app/pages/pomiary/pomiary.html` / `.css` |
| logikę formularza, tapping test, walidację w przeglądarce | `src/app/pages/pomiary/pomiary.ts` |
| grupy serii i zakresy czasu na wykresie | `src/app/pages/wykres/wykres.ts` (stałe `GRUPY`, `ZAKRESY`) |
| kolumny tabeli w panelu wuefisty | `src/app/pages/admin/admin.ts` (pole `kolumny`) |
| adres API dla aplikacji na telefonie | `src/app/config.ts`, stała `API_URL_TELEFON` |
| regułę „jeden wpis dziennie”, walidację serwera | `wf-api/server.js` |

### Jak wybierany jest adres API

`src/app/config.ts`:

- aplikacja natywna (Capacitor) → stały publiczny adres `API_URL_TELEFON` (tunel ngrok),
- `ng serve` na porcie 4200 → `http://<host>:3000/api`,
- strona serwowana przez `wf-api` (localhost, adres w sieci, tunel) → ten sam adres co strona.

Do darmowego ngroka dokładany jest nagłówek `ngrok-skip-browser-warning`, bez którego ngrok zwraca
stronę z ostrzeżeniem zamiast danych (interceptor w `app.config.ts`).

---

## 7. Uruchomienie

### Wymagania

- Node.js 24+ i npm,
- SQL Server z bazą `PomiaryDB` (instancja `localhost\MSSQLSERVER04`, logowanie Windows),
- sterownik „ODBC Driver 18 for SQL Server”,
- opcjonalnie: ngrok (dostęp z telefonu spoza sieci), Android Studio (build APK), konto GitHub i
  Sideloadly (build na iPhone).

### Pierwsze uruchomienie

```bash
npm install
```
```bash
cd wf-api && npm install
```
```bash
sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/komorki.sql
```
```bash
sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/migracja-nowe-parametry.sql
```
```bash
sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/przyklad.sql
```

Inną instancję SQL Servera ustawia się zmienną `DB_SERVER`, a inną bazę zmienną `DB_NAME`.

### Codzienna praca — dwa terminale w `C:\apkaWF`

```bash
npm run telefon
```
buduje frontend i uruchamia serwer: aplikacja i API pod `http://localhost:3000`.

```bash
npm run tunel
```
uruchamia ngroka i daje publiczny adres HTTPS — potrzebny tylko dla aplikacji zainstalowanych na
telefonach albo dostępu spoza domowej sieci.

Zatrzymanie: `Ctrl+C` w obu terminalach. Baza SQL Server startuje z Windowsem sama.

### Wszystkie polecenia npm

| Polecenie | Co robi |
|---|---|
| `npm start` | dev-serwer Angulara na porcie 4200 (przeładowanie po zmianie kodu, API trzeba uruchomić osobno) |
| `npm run build` | build produkcyjny do `dist/apkaWF/browser` |
| `npm test` | testy jednostkowe (Vitest) |
| `npm run telefon` | build + serwer API z frontendem (port 3000) |
| `npm run tunel` | publiczny adres HTTPS przez ngroka |
| `npm run android` | build + skopiowanie kodu do projektu Android |
| `npm run apk` | jw. + zbudowanie `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run ios` | build + skopiowanie kodu do projektu iOS |

### Adresy

| Co | Adres |
|---|---|
| Aplikacja (komputer) | http://localhost:3000 |
| Aplikacja (telefon w tej samej sieci) | `http://<IP komputera>:3000` — adres wypisuje serwer przy starcie |
| Aplikacja przez internet | adres z `npm run tunel` |
| Dokumentacja API | http://localhost:3000/api-docs |
| Podgląd ruchu z telefonów | http://127.0.0.1:4040 (panel ngroka) |

---

## 8. Obsługa aplikacji

### Zawodnik

1. **Logowanie**: pseudonim + komórka → „Wejdź”.
2. **Dzienny wpis** — cztery sekcje:
   - **Trening**: czas (przełącznik h/min) i RPE 0–10; pod spodem od razu widać obciążenie w AU,
   - **Praca (poza treningiem)**: to samo dla wysiłku zawodowego,
   - **Regeneracja**: sen w godzinach (krok 0,25 = 15 min) i tętno po przebudzeniu,
   - **Gotowość**: chęć do treningu (buźki) i tapping test.
3. **Tapping test**: przycisk „Rozpocznij test (10 s)” włącza pole, w które trzeba stukać jak
   najszybciej. Po 10 sekundach test kończy się sam i zapisuje liczbę stuknięć. Wynik jest polem
   tylko do odczytu, więc przypadkowe dotknięcie niczego nie kasuje; powtórzenie wymaga przycisku
   „Powtórz test”. Pod polem widać **średnią z ostatnich 7 dni**.
4. **Zapis**: przycisk „Zapisz”, a gdy wpis na dziś już istnieje — „Nadpisz”. Nad formularzem widać
   status: „Dzisiejszy wpis zapisany o 10:31” wraz z przyciskiem „Usuń” (z potwierdzeniem).
5. **Wykres**: przycisk „Wykres” w stopce. U góry zakres czasu (Tydzień / Miesiąc / 3 miesiące /
   Wszystko), niżej wybór grupy: Obciążenie (AU), Czas (min), RPE, Sen i tętno, Gotowość.
   Pod wykresem kafelki z ostatnim pomiarem.
6. **Wylogowanie**: ikona w prawym górnym rogu, z potwierdzeniem. Dopiero to usuwa zapamiętanie
   urządzenia.

### Wuefista

1. Logowanie pseudonimem `wuefista` (wybór komórki bez znaczenia).
2. **Wybór komórki**: zakładki na komputerze, lista rozwijana na telefonie (z liczbą osób).
3. **Lista osób**: pseudonim, data ostatniego wpisu i liczba wpisów.
4. **Wpisy wybranej osoby**: na komputerze tabela ze wszystkimi parametrami i obciążeniami,
   na telefonie karty. Lista doczytuje kolejne 25 wpisów przy przewijaniu w dół, a na dole widać
   „Pokazano X z Y”. Nad listą jest średnia tappingu z 7 dni.
5. **Usuwanie wpisu**: ikona kosza w wierszu (albo na karcie), z potwierdzeniem.
6. **Wykres osoby**: przycisk „Wykres” obok jej pseudonimu.

---

## 9. Aplikacje na telefon

Wspólne: aplikacja natywna łączy się z API pod adresem z `src/app/config.ts`
(`API_URL_TELEFON`), więc na komputerze muszą działać `npm run telefon` i `npm run tunel`.
Po zmianie tego adresu albo kodu w `src/` trzeba zbudować aplikację od nowa i wgrać ją ponownie.
Zmiany wyłącznie w `wf-api/` nie wymagają aktualizacji aplikacji na telefonach.

### Android

```bash
npm run apk
```

Plik: `android/app/build/outputs/apk/debug/app-debug.apk`. Kopiujemy na telefon, otwieramy,
zezwalamy na instalację z nieznanych źródeł, instalujemy. Aplikacja nie wygasa.

Projekt Android jest w katalogu `android/`, ikony w `android/app/src/main/res/mipmap-*`.

### iPhone

Kompilacja iOS wymaga macOS, dlatego plik `.ipa` buduje GitHub Actions
(`.github/workflows/ios.yml`, uruchamiany ręcznie z zakładki Actions):

```bash
npm run ios
```
```bash
git push
```

Następnie: Actions → „iOS – plik IPA” → Run workflow → po ~10 min pobrać artefakt **Pomiary-ipa** →
rozpakować → w programie **Sideloadly** przeciągnąć `Pomiary.ipa`, podać Apple ID → Start →
na telefonie zaufać profilowi i włączyć tryb dewelopera. Z darmowym Apple ID aplikacja działa 7 dni,
potem trzeba ją wgrać ponownie (dane w bazie zostają).

Projekt iOS jest w katalogu `ios/`, konfiguracja Capacitora w `capacitor.config.ts`
(identyfikator `pl.pomiary.wysilkowe`, nazwa „Pomiary”).

---

## 10. Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| „Brak połączenia z API (czy serwer wf-api działa na porcie 3000?)” | nie działa `npm run telefon` albo serwer został zatrzymany |
| Aplikacja na telefonie nie ładuje danych | nie działa `npm run tunel`, komputer jest uśpiony albo zmienił się adres tunelu |
| `EADDRINUSE` / „Port 3000 is in use” | działa już druga kopia serwera — zamknij stary terminal |
| Operator komórkowy blokuje adres ngroka (strona z ostrzeżeniem) | darmowe domeny `*.ngrok-free.dev` bywają na listach blokad; obejście to szyfrowany DNS na telefonie, własna domena albo inny tunel (np. Tailscale Funnel) |
| `sqlcmd` pokazuje krzaczki zamiast polskich znaków | dodaj `-f 65001` |
| `CREATE TABLE failed ... QUOTED_IDENTIFIER` | skrypt musi mieć `SET QUOTED_IDENTIFIER ON` (mają go skrypty w repo) |
| Android: „SDK location not found” | brak `android/local.properties`; wpisz `sdk.dir=C:/ASJDK` (albo własną ścieżkę do Android SDK) |
| Android: „Unable to establish loopback connection” / „Could not receive a message from the daemon” | Java nie radzi sobie z polskimi znakami w ścieżce katalogu tymczasowego; obchodzi to `android/build-apk.cmd` i `android/gradle.properties` — buduj przez `npm run apk`, a nie samym `gradlew` |
| Build iOS na GitHubie kończy się błędem | sprawdź log kroku „Kompilacja aplikacji”; workflow używa obrazu `macos-26`, przy zmianach wersji Xcode może wymagać aktualizacji |
| Zapis odrzucony mimo poprawnych wartości | sprawdź sumę czasu treningu i pracy (maksimum 24 h) oraz krok snu (0,25 h) |

Przydatne do diagnozy:

- terminal `npm run telefon` — dziennik zapytań z telefonów,
- http://127.0.0.1:4040 — inspektor ngroka (pełna treść zapytań i odpowiedzi, funkcja „Replay”),
- http://localhost:3000/api-docs — ręczne wywołanie endpointu („Try it out”).

---

## 11. Ograniczenia i możliwe kolejne kroki

Znane ograniczenia:

- **Brak uwierzytelniania.** Pseudonim wuefisty wystarcza, by zobaczyć dane wszystkich. Naturalne
  rozszerzenie to kolumna `Pin` w tabeli `Uzytkownicy` i pytanie o PIN przy roli `admin`.
- **Serwer działa na komputerze domowym.** Usługa jest dostępna tylko wtedy, gdy komputer jest
  włączony, a tunel uruchomiony. Docelowo: API i baza w chmurze.
- **Tapping test** zapisuje wyłącznie liczbę stuknięć z jednej próby. Nie ma liczby prób ani
  odstępów między stuknięciami.
- **Archiwum** (`PomiaryArchiwum`) nie ma podglądu w aplikacji — dane są dostępne tylko w SSMS.
- **Średnie i wskaźniki pochodne** liczą się w przeglądarce (średnia tappingu z 7 dni). Nie ma
  jeszcze zestawień tygodniowych, monotonii treningu ani wskaźnika ACWR.
- **Testy**: jest tylko jeden test jednostkowy (utworzenie komponentu głównego). Logika walidacji
  i przeliczeń nie jest pokryta testami.

Możliwe kolejne kroki: PIN dla wuefisty, zakładka „Archiwum”, tygodniowe sumy obciążenia i wskaźnik
ACWR, eksport do CSV/Excela, powiadomienia przypominające o wpisie.
