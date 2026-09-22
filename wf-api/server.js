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

// Dokumentacja OpenAPI: specyfikacja w openapi.yaml, podgląd Swagger UI pod /api-docs
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');
const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8'));
app.get('/openapi.json', (req, res) => res.json(openapi));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Pomiary Wysiłkowe – API' }));

// msnodesqlv8 zwraca INT jako string - zamieniamy na liczby
const INT_COLS = ['Id', 'KomorkaId', 'UzytkownikId', 'TetnoSpoczynek', 'TetnoWysilek',
  'CisnienieSkurcz', 'CisnienieRozkurcz', 'SpO2', 'CzasMin', 'RPE', 'LiczbaOsob'];
const norm = (rows) => rows.map((row) => {
  const o = { ...row };
  for (const k of INT_COLS) if (o[k] != null) o[k] = Number(o[k]);
  return o;
});

// Zakresy walidacji pomiarów: [kolumna, pole w JSON, min, max, etykieta]
const ZAKRESY = [
  ['TetnoSpoczynek', 'tetnoSpoczynek', 30, 220, 'Tętno spoczynkowe'],
  ['TetnoWysilek', 'tetnoWysilek', 30, 220, 'Tętno po wysiłku'],
  ['CisnienieSkurcz', 'cisnienieSkurcz', 70, 250, 'Ciśnienie skurczowe'],
  ['CisnienieRozkurcz', 'cisnienieRozkurcz', 40, 150, 'Ciśnienie rozkurczowe'],
  ['SpO2', 'spo2', 70, 100, 'SpO₂'],
  ['CzasMin', 'czasMin', 1, 600, 'Czas wysiłku'],
  ['RPE', 'rpe', 6, 20, 'RPE'],
];

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
  let wypelnione = 0;
  for (const [col, key, min, max, label] of ZAKRESY) {
    const raw = m[key];
    let v = null;
    if (raw !== null && raw !== undefined && raw !== '') {
      v = Number(raw);
      if (!Number.isInteger(v) || v < min || v > max) {
        return res.status(400).json({ error: `${label}: dozwolony zakres ${min}–${max}.` });
      }
      wypelnione++;
    }
    rq.input(col, sql.Int, v);
  }
  if (wypelnione === 0) return res.status(400).json({ error: 'Wpisz przynajmniej jeden pomiar.' });

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
