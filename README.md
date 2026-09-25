# Pomiary Wysiłkowe

Aplikacja do rejestrowania parametrów fizjologicznych podczas wysiłku.
Stos: **Angular 22 + Ionic 9** (frontend) → **Node.js + Express** (`wf-api/`) → **SQL Server** (`PomiaryDB`).

## Uruchomienie

1. **Baza**: instancja `localhost\MSSQLSERVER04`, baza `PomiaryDB`, logowanie Windows.
   API łączy się sterownikiem `msnodesqlv8` (wymaga „ODBC Driver 18 for SQL Server”).
   Inną instancję ustawisz zmienną środowiskową `DB_SERVER`.
   Dodatkowe komórki (łącznie 10) dodaje skrypt `wf-api/db/komorki.sql`.
   Nowy zestaw parametrów wprowadza `wf-api/db/migracja-nowe-parametry.sql` (stare pomiary trafiają do `PomiaryArchiwum`).
   Dane przykładowe (40 osób, wpisy z ostatnich 90 dni) tworzy `wf-api/db/przyklad.sql`,
   a usuwa `wf-api/db/przyklad_usun.sql`:
   ```bash
   sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/przyklad.sql
   ```
2. **API** (port 3000):
   ```bash
   cd wf-api
   npm install
   npm start
   ```
3. **Frontend** (port 4200):
   ```bash
   npm install
   npm start
   ```
   Otwórz http://localhost:4200. Dowolny pseudonim otwiera panel użytkownika, a `wuefista` panel admina.

## Telefon (iPhone / Android)

```bash
npm run telefon
```
Polecenie buduje frontend i uruchamia serwer, który udostępnia aplikację i API pod jednym adresem.
Adres do otwarcia na telefonie (np. `http://192.168.18.11:3000`) pojawi się w konsoli.
Telefon musi być w tej samej sieci Wi-Fi, a sieć w Windows musi mieć profil **Prywatna**.
Na iPhonie: Safari → Udostępnij → „Do ekranu początkowego”. Na Androidzie: Chrome → ⋮ → „Dodaj do ekranu głównego”.

## Aplikacja iOS (Capacitor)

- Projekt Xcode jest w `ios/`, a konfiguracja w `capacitor.config.ts`.
- Adres API dla aplikacji na telefonie to stała `API_URL_TELEFON` w `src/app/config.ts`, obecnie tunel ngrok `https://causation-these-attendee.ngrok-free.dev/api`.
  Żeby usługa działała, na komputerze muszą być uruchomione `npm run telefon` (API i baza) oraz `npm run tunel` (ngrok).
- `npm run ios` buduje frontend i kopiuje go do projektu iOS.
- Plik `.ipa` bez Maca buduje GitHub Actions: workflow `.github/workflows/ios.yml`, uruchamiany ręcznie z zakładki Actions.
- Plik `.ipa` podpisuje się i instaluje na iPhonie programem Sideloadly (Windows) z własnym Apple ID. Z darmowym kontem aplikacja działa 7 dni.

## Struktura

| Ścieżka | Zawartość |
|---|---|
| `wf-api/server.js` | REST API, walidacja zakresów i limitu doby (24 h) |
| `src/app/services/api.service.ts` | wywołania HTTP i zalogowany użytkownik (w `localStorage`) |
| `src/app/parametry.ts` | parametry wpisywane i wyliczane (sRPE), jednostki, zakresy, skale |
| `src/app/guards.ts` | `authGuard`, `adminGuard`, `goscGuard` |
| `src/app/pages/login` | pseudonim i komórka organizacyjna |
| `src/app/pages/pomiary` | dzienny wpis: czas i RPE treningu oraz pracy, sen, tętno poranne, chęć do treningu, tapping test |
| `src/app/pages/wykres` | wykres liniowy (Chart.js / ng2-charts), `/wykres/:userId` |
| `src/app/pages/admin` | komórki → osoby → tabela pomiarów i wykres |

## API

Specyfikacja OpenAPI 3.0 jest w [`wf-api/openapi.yaml`](wf-api/openapi.yaml). Przy działającym API:
- http://localhost:3000/api-docs to Swagger UI, czyli dokumentacja z możliwością wywoływania endpointów („Try it out”),
- http://localhost:3000/openapi.json to specyfikacja w JSON, np. do importu w Postmanie.

Po zmianie endpointów w `server.js` trzeba ręcznie zaktualizować `openapi.yaml`. Poprawność sprawdza:
```bash
npx @redocly/cli lint wf-api/openapi.yaml
```

| Metoda | Adres | Opis |
|---|---|---|
| GET | `/api/komorki` | komórki i liczba osób w każdej |
| POST | `/api/login` | `{pseudonim, komorkaId}`: zwraca użytkownika, a nowego tworzy |
| GET | `/api/uzytkownicy/:id` | dane użytkownika |
| GET | `/api/pomiary/:userId` | pomiary użytkownika (rosnąco po dacie) |
| POST | `/api/pomiary` | zapis pomiaru z walidacją zakresów |
| GET | `/api/komorki/:id/uzytkownicy` | osoby w komórce z liczbą pomiarów |
