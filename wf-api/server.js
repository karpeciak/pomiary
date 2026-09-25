const express = require('express');
const cors = require('cors');
// Sterownik msnodesqlv8 = logowanie Windows (instancja MSSQLSERVER04 nie ma logowania SQL / konta sa)
const sql = require('mssql/msnodesqlv8');

const PORT = process.env.PORT || 3000;
const DB_SERVER = process.env.DB_SERVER || 'localhost\\MSSQLSERVER04';
const DB_NAME = process.env.DB_NAME || 'PomiaryDB';

const config = {
  connectionString:
    `Driver={ODBC Driver 18 for SQL Server};Server=${DB_SERVER};Database=${DB_NAME};` +
    'Trusted_Connection=yes;TrustServerCertificate=yes;',
  options: { useUTC: false }, // DATETIME w bazie to czas lokalny (GETDATE())
};
const pool = sql.connect(config);

const app = express();
app.use(cors());
app.use(express.json());

// Dziennik ruchu w konsoli: godzina, urządzenie, zapytanie, status, czas odpowiedzi (tylko /api, bez OPTIONS)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') || req.method === 'OPTIONS') return next();
  const start = Date.now();
  res.on('finish', () => {
    const ua = req.get('user-agent') || '';
    const urzadzenie = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android'
      : /Mozilla/.test(ua) ? 'przeglądarka' : 'inne';
    const godz = new Date().toLocaleTimeString('pl-PL');
    const kto = req.body?.pseudonim ? ` (${req.body.pseudonim})` : '';
    console.log(`${godz}  ${urzadzenie.padEnd(12)} ${req.method.padEnd(6)} ${req.originalUrl}${kto}  → ${res.statusCode}  ${Date.now() - start} ms`);
  });
  next();
});

// Dokumentacja OpenAPI: specyfikacja w openapi.yaml, podgląd Swagger UI pod /api-docs
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');
const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8'));
app.get('/openapi.json', (req, res) => res.json(openapi));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Pomiary Wysiłkowe – API' }));

// msnodesqlv8 zwraca liczby jako string - zamieniamy na typ liczbowy
const LICZBY = ['Id', 'KomorkaId', 'UzytkownikId', 'LiczbaOsob', 'LiczbaPomiarow',
  'CzasTreningu', 'RpeTreningu', 'CzasPracy', 'RpePracy', 'TetnoPoranne', 'Sen',
  'ChecDoTreningu', 'Tapping', 'ObciazenieTreningowe', 'ObciazeniePraca'];
const norm = (rows) => rows.map((row) => {
  const o = { ...row };
  for (const k of LICZBY) if (o[k] != null) o[k] = Number(o[k]);
  return o;
});

// Parametry pomiaru: [kolumna, pole w JSON, min, max, krok, etykieta]
// krok 1 = liczba całkowita, 0.25 = wielokrotność 15 minut (sen)
const ZAKRESY = [
  ['CzasTreningu', 'czasTreningu', 0, 1440, 1, 'Czas treningu (min)'],
  ['RpeTreningu', 'rpeTreningu', 0, 10, 1, 'RPE treningu'],
  ['CzasPracy', 'czasPracy', 0, 1440, 1, 'Czas pracy (min)'],
  ['RpePracy', 'rpePracy', 0, 10, 1, 'RPE pracy'],
  ['TetnoPoranne', 'tetnoPoranne', 20, 120, 1, 'Tętno po przebudzeniu'],
  ['Sen', 'sen', 0, 12, 0.25, 'Ilość snu (h)'],
  ['ChecDoTreningu', 'checDoTreningu', 1, 5, 1, 'Chęć do treningu'],
  ['Tapping', 'tapping', 0, 500, 1, 'Tapping test'],
];

// Obciążenia (sRPE) liczy baza jako kolumny wyliczane - API ich nie zapisuje
const DOBA_MIN = 1440;

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: 'Błąd serwera: ' + e.message });
  });

app.get('/api/komorki', wrap(async (req, res) => {
  const r = await (await pool).request().query(`
    SELECT k.Id, k.Nazwa,
      (SELECT COUNT(*) FROM Uzytkownicy u WHERE u.KomorkaId = k.Id AND u.Rola = 'user') AS LiczbaOsob
    FROM Komorki k ORDER BY k.Nazwa`);
  res.json(norm(r.recordset));
}));

app.post('/api/login', wrap(async (req, res) => {
  const pseudonim = String(req.body.pseudonim || '').trim();
  const komorkaId = Number(req.body.komorkaId);
  if (!pseudonim || pseudonim.length > 50) {
    return res.status(400).json({ error: 'Podaj pseudonim (maks. 50 znaków).' });
  }
  const p = await pool;
  let r = await p.request().input('ps', sql.NVarChar(50), pseudonim)
    .query('SELECT * FROM Uzytkownicy WHERE Pseudonim = @ps');

  if (r.recordset.length === 0) {
    if (!Number.isInteger(komorkaId)) {
      return res.status(400).json({ error: 'Wybierz komórkę organizacyjną.' });
    }
    const k = await p.request().input('k', sql.Int, komorkaId)
      .query('SELECT Id FROM Komorki WHERE Id = @k');
    if (k.recordset.length === 0) return res.status(400).json({ error: 'Nie ma takiej komórki.' });

    r = await p.request().input('ps', sql.NVarChar(50), pseudonim).input('k', sql.Int, komorkaId)
      .query(`INSERT INTO Uzytkownicy (Pseudonim, KomorkaId) OUTPUT INSERTED.* VALUES (@ps, @k)`);
  }
  res.json(norm(r.recordset)[0]);
}));

app.get('/api/uzytkownicy/:id', wrap(async (req, res) => {
  const r = await (await pool).request().input('id', sql.Int, Number(req.params.id))
    .query(`SELECT u.*, k.Nazwa AS KomorkaNazwa FROM Uzytkownicy u
            LEFT JOIN Komorki k ON k.Id = u.KomorkaId WHERE u.Id = @id`);
  if (r.recordset.length === 0) return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
  res.json(norm(r.recordset)[0]);
}));

app.get('/api/pomiary/:userId', wrap(async (req, res) => {
  const r = await (await pool).request().input('id', sql.Int, Number(req.params.userId))
    .query('SELECT * FROM Pomiary WHERE UzytkownikId = @id ORDER BY Data');
  res.json(norm(r.recordset));
}));

app.post('/api/pomiary', wrap(async (req, res) => {
  const m = req.body || {};
  const uid = Number(m.uzytkownikId);
  if (!Number.isInteger(uid)) return res.status(400).json({ error: 'Brak użytkownika.' });

  const rq = (await pool).request().input('u', sql.Int, uid);
  const wartosci = {};
  let wypelnione = 0;
  for (const [col, key, min, max, krok, label] of ZAKRESY) {
    const raw = m[key];
    let v = null;
    if (raw !== null && raw !== undefined && raw !== '') {
      v = Number(raw);
      if (Number.isNaN(v) || v < min || v > max) {
        return res.status(400).json({ error: `${label}: dozwolony zakres ${min}–${max}.` });
      }
      // wielokrotność kroku (1 = liczba całkowita, 0.25 = kwadrans snu)
      if (Math.abs(Math.round(v / krok) - v / krok) > 1e-9) {
        return res.status(400).json({
          error: krok === 1 ? `${label}: podaj liczbę całkowitą.` : `${label}: dozwolony krok co ${krok}.`,
        });
      }
      wypelnione++;
    }
    wartosci[key] = v;
    rq.input(col, krok === 1 ? sql.Int : sql.Decimal(4, 2), v);
  }
  if (wypelnione === 0) return res.status(400).json({ error: 'Wpisz przynajmniej jedną wartość.' });

  // doba ma 24 h - trening i praca razem nie mogą jej przekroczyć
  const razem = (wartosci.czasTreningu ?? 0) + (wartosci.czasPracy ?? 0);
  if (razem > DOBA_MIN) {
    return res.status(400).json({
      error: `Czas treningu i pracy razem to ${razem} min, a doba ma ${DOBA_MIN} min.`,
    });
  }

  // Jeden pomiar dziennie: jeśli dziś już jest pomiar, nadpisujemy go (i usuwamy ewentualne dzisiejsze duplikaty)
  const cols = ZAKRESY.map((z) => z[0]);
  const r = await rq.query(`
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRAN;
    DECLARE @dzis DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME);
    DECLARE @id INT = (
      SELECT TOP 1 Id FROM Pomiary WITH (UPDLOCK, HOLDLOCK)
      WHERE UzytkownikId = @u AND Data >= @dzis AND Data < DATEADD(DAY, 1, @dzis)
      ORDER BY Data DESC);
    IF @id IS NULL
      INSERT INTO Pomiary (UzytkownikId, ${cols.join(', ')})
      OUTPUT INSERTED.*, CAST(0 AS BIT) AS Nadpisany
      VALUES (@u, ${cols.map((c) => '@' + c).join(', ')});
    ELSE
    BEGIN
      DELETE FROM Pomiary
      WHERE UzytkownikId = @u AND Data >= @dzis AND Data < DATEADD(DAY, 1, @dzis) AND Id <> @id;
      UPDATE Pomiary SET Data = GETDATE(), ${cols.map((c) => `${c} = @${c}`).join(', ')}
      OUTPUT INSERTED.*, CAST(1 AS BIT) AS Nadpisany
      WHERE Id = @id;
    END
    COMMIT;`);
  const zapisany = norm(r.recordset)[0];
  zapisany.Nadpisany = zapisany.Nadpisany === true || zapisany.Nadpisany === 1 || zapisany.Nadpisany === '1';
  res.json(zapisany);
}));

// Usunięcie pomiaru: właściciel albo admin (?uzytkownikId= to osoba, która usuwa)
app.delete('/api/pomiary/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const kto = Number(req.query.uzytkownikId);
  if (!Number.isInteger(id) || !Number.isInteger(kto)) {
    return res.status(400).json({ error: 'Brak identyfikatora pomiaru lub użytkownika.' });
  }
  const p = await pool;
  const r = await p.request().input('id', sql.Int, id).input('kto', sql.Int, kto).query(`
    SELECT p.UzytkownikId, (SELECT Rola FROM Uzytkownicy WHERE Id = @kto) AS RolaKto
    FROM Pomiary p WHERE p.Id = @id`);
  if (r.recordset.length === 0) return res.status(404).json({ error: 'Nie ma takiego pomiaru.' });
  const { UzytkownikId, RolaKto } = r.recordset[0];
  if (RolaKto !== 'admin' && Number(UzytkownikId) !== kto) {
    return res.status(403).json({ error: 'Możesz usuwać tylko swoje pomiary.' });
  }
  await p.request().input('id', sql.Int, id).query('DELETE FROM Pomiary WHERE Id = @id');
  res.json({ ok: true });
}));

app.get('/api/komorki/:id/uzytkownicy', wrap(async (req, res) => {
  const r = await (await pool).request().input('id', sql.Int, Number(req.params.id))
    .query(`SELECT u.Id, u.Pseudonim, u.KomorkaId, u.Rola,
              (SELECT COUNT(*) FROM Pomiary p WHERE p.UzytkownikId = u.Id) AS LiczbaPomiarow,
              (SELECT MAX(Data) FROM Pomiary p WHERE p.UzytkownikId = u.Id) AS OstatniPomiar
            FROM Uzytkownicy u WHERE u.KomorkaId = @id AND u.Rola = 'user' ORDER BY u.Pseudonim`);
  res.json(norm(r.recordset).map((u) => ({ ...u, LiczbaPomiarow: Number(u.LiczbaPomiarow) })));
}));

// Zbudowany frontend (npx ng build) - telefon otwiera całą aplikację pod jednym adresem http://<IP>:3000
const FRONTEND = path.join(__dirname, '..', 'dist', 'apkaWF', 'browser');
if (fs.existsSync(path.join(FRONTEND, 'index.html'))) {
  app.use(express.static(FRONTEND));
  // trasy Angulara (/login, /pomiary, /admin, ...) -> index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(FRONTEND, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`API: http://localhost:${PORT}/api  (baza: ${DB_SERVER}/${DB_NAME})`);
  // adresy w sieci lokalnej - do otwarcia na telefonie
  const adresy = Object.values(require('os').networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
  if (fs.existsSync(path.join(FRONTEND, 'index.html'))) {
    for (const ip of adresy) console.log(`Aplikacja na telefonie: http://${ip}:${PORT}`);
  } else {
    console.log('Frontend nie jest zbudowany - uruchom "npx ng build" w katalogu głównym.');
  }
});
