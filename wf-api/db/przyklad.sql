-- Przykładowe dane dla nowego zestawu parametrów (obciążenie, regeneracja, gotowość).
-- 40 użytkowników w 10 komórkach, wpisy z ostatnich 90 dni (jeden na dzień).
-- Skrypt można uruchamiać wielokrotnie - najpierw usuwa poprzednie dane przykładowe.
-- Uruchomienie: sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/przyklad.sql
USE PomiaryDB;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

DECLARE @DNI INT = 90;

-- Profil zawodnika: typowe wartości i jak często w ogóle wypełnia wpis (%)
DECLARE @osoby TABLE (
  Pseudonim NVARCHAR(50), Komorka NVARCHAR(100),
  CzasTren INT, RpeTren INT, CzasPracy INT, RpePracy INT,
  HrRano INT, SenKwadranse INT, Chec INT, Tapping INT, Czestosc INT
);
INSERT INTO @osoby VALUES
  -- Kadra
  (N'kpt_zielinski',    N'Kadra',     60, 6, 480, 3, 52, 30, 4, 62, 75),
  (N'sierz_wojcik',     N'Kadra',     45, 7, 540, 4, 64, 26, 3, 55, 55),
  (N'por_adamczyk',     N'Kadra',     50, 5, 480, 3, 56, 29, 4, 58, 65),
  (N'chor_lewandowski', N'Kadra',     40, 6, 540, 4, 66, 25, 2, 52, 45),
  -- Pluton 1
  (N'marek_k',          N'Pluton 1',  75, 7, 420, 3, 58, 30, 4, 60, 80),
  (N'tomek92',          N'Pluton 1',  90, 6, 360, 2, 54, 32, 5, 66, 85),
  (N'dawid_w',          N'Pluton 1',  45, 8, 480, 5, 68, 24, 2, 50, 55),
  (N'kamil_s',          N'Pluton 1',  80, 6, 420, 3, 55, 31, 4, 63, 75),
  (N'olek',             N'Pluton 1',  60, 7, 480, 3, 61, 28, 3, 57, 65),
  -- Pluton 2
  (N'ania_w',           N'Pluton 2',  70, 6, 420, 3, 62, 31, 4, 64, 70),
  (N'bartek',           N'Pluton 2',  40, 8, 540, 5, 70, 23, 2, 48, 50),
  (N'kuba_s',           N'Pluton 2',  85, 7, 360, 2, 56, 32, 5, 68, 85),
  (N'natalia_p',        N'Pluton 2',  65, 6, 450, 3, 64, 30, 4, 62, 70),
  -- Pluton 3
  (N'ola_m',            N'Pluton 3',  60, 6, 480, 3, 60, 29, 4, 61, 70),
  (N'piotr_z',          N'Pluton 3', 100, 7, 300, 2, 50, 33, 5, 70, 90),
  (N'filip_r',          N'Pluton 3',  50, 7, 500, 4, 65, 26, 3, 54, 60),
  (N'zosia',            N'Pluton 3',  45, 6, 480, 3, 67, 27, 3, 58, 55),
  -- Pluton 4
  (N'krzysiek',         N'Pluton 4',  30, 9, 600, 6, 74, 21, 1, 45, 40),
  (N'mateusz_b',        N'Pluton 4',  75, 6, 420, 3, 57, 30, 4, 62, 75),
  (N'iga_k',            N'Pluton 4',  60, 6, 450, 3, 63, 30, 4, 63, 70),
  -- Pluton 5
  (N'magda_l',          N'Pluton 5',  70, 6, 420, 3, 59, 31, 4, 65, 75),
  (N'michal_d',         N'Pluton 5',  55, 7, 480, 4, 64, 27, 3, 56, 60),
  (N'wojtek_s',         N'Pluton 5',  35, 8, 540, 5, 72, 22, 2, 47, 40),
  (N'ala_n',            N'Pluton 5',  65, 6, 450, 3, 61, 30, 4, 64, 70),
  -- Pluton 6
  (N'rafal_p',          N'Pluton 6',  95, 7, 360, 2, 52, 32, 5, 69, 85),
  (N'szymon_t',         N'Pluton 6',  45, 8, 510, 4, 69, 24, 2, 51, 50),
  (N'karolina_j',       N'Pluton 6',  70, 6, 420, 3, 60, 31, 4, 65, 75),
  -- Pluton 7
  (N'ewa_k',            N'Pluton 7',  60, 6, 480, 3, 62, 29, 4, 62, 70),
  (N'adrian_m',         N'Pluton 7',  85, 7, 390, 3, 55, 31, 4, 66, 80),
  (N'julia_w',          N'Pluton 7',  55, 6, 450, 3, 64, 30, 4, 63, 65),
  (N'pawel_g',          N'Pluton 7',  30, 9, 600, 6, 75, 20, 1, 44, 35),
  -- Pluton 8
  (N'damian',           N'Pluton 8',  50, 7, 500, 4, 66, 26, 3, 55, 60),
  (N'monika_z',         N'Pluton 8',  65, 6, 450, 3, 61, 30, 4, 64, 70),
  (N'grzes',            N'Pluton 8',  40, 7, 520, 4, 68, 25, 2, 52, 45),
  -- Pluton 9
  (N'lukasz_c',         N'Pluton 9',  75, 6, 420, 3, 58, 31, 4, 63, 75),
  (N'sandra_b',         N'Pluton 9',  60, 6, 450, 3, 63, 30, 4, 62, 70),
  (N'hubert_k',         N'Pluton 9',  35, 8, 540, 5, 71, 23, 2, 49, 45),
  (N'norbert_s',        N'Pluton 9',  90, 7, 360, 2, 53, 32, 5, 68, 85),
  -- nowi, jeszcze bez wpisów
  (N'patryk_n',         N'Pluton 9',  60, 6, 480, 3, 62, 30, 3, 60,  0),
  (N'nowy_rekrut',      N'Pluton 4',  60, 6, 480, 3, 62, 30, 3, 60,  0);

-- 1. Usuń poprzednie wpisy tych osób (archiwum zostaje nietknięte)
DELETE p FROM Pomiary p
JOIN Uzytkownicy u ON u.Id = p.UzytkownikId
JOIN @osoby o ON o.Pseudonim = u.Pseudonim;

-- 2. Użytkownicy - dodaj tych, których jeszcze nie ma
INSERT INTO Uzytkownicy (Pseudonim, KomorkaId, Rola)
SELECT o.Pseudonim, k.Id, 'user'
FROM @osoby o JOIN Komorki k ON k.Nazwa = o.Komorka
WHERE NOT EXISTS (SELECT 1 FROM Uzytkownicy u WHERE u.Pseudonim = o.Pseudonim);

-- 3. Wpisy: dni 1..@DNI wstecz, losowo wg częstości.
--    Z czasem lekka poprawa: niższe tętno poranne, dłuższe treningi, lepsza chęć.
--    Co siódmy dzień jest wolny od treningu (czas i RPE treningu = 0).
;WITH dni AS (
  SELECT TOP (@DNI) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS d FROM sys.all_objects
),
wiersze AS (
  SELECT u.Id AS UzytkownikId, o.*, dn.d,
         (CAST(@DNI AS DECIMAL(9,2)) - dn.d) / @DNI AS postep,
         CASE WHEN dn.d % 7 = 0 THEN 1 ELSE 0 END AS dzien_wolny,
         ABS(CHECKSUM(NEWID())) % 100 AS los_dzien,
         ABS(CHECKSUM(NEWID())) % 660 AS los_minuta,           -- 7:00-18:00
         ABS(CHECKSUM(NEWID())) % 31 - 15 AS r_czas_tren,      -- +/- 15 min
         ABS(CHECKSUM(NEWID())) % 3  - 1  AS r_rpe_tren,
         ABS(CHECKSUM(NEWID())) % 121 - 60 AS r_czas_pracy,    -- +/- 1 h
         ABS(CHECKSUM(NEWID())) % 3  - 1  AS r_rpe_pracy,
         ABS(CHECKSUM(NEWID())) % 7  - 3  AS r_hr,
         ABS(CHECKSUM(NEWID())) % 9  - 4  AS r_sen,            -- +/- 1 h w kwadransach
         ABS(CHECKSUM(NEWID())) % 3  - 1  AS r_chec,
         ABS(CHECKSUM(NEWID())) % 11 - 5  AS r_tap,
         ABS(CHECKSUM(NEWID())) % 100 AS los_brak_tap          -- czasem bez tapping testu
  FROM @osoby o
  JOIN Uzytkownicy u ON u.Pseudonim = o.Pseudonim
  CROSS JOIN dni dn
),
policzone AS (
  SELECT UzytkownikId,
         DATEADD(MINUTE, 420 + los_minuta, CAST(CAST(DATEADD(DAY, -d, GETDATE()) AS DATE) AS DATETIME)) AS Data,
         CASE WHEN dzien_wolny = 1 THEN 0
              ELSE CzasTren + CAST(ROUND(10 * postep, 0) AS INT) + r_czas_tren END AS CzasTreningu,
         CASE WHEN dzien_wolny = 1 THEN 0 ELSE RpeTren + r_rpe_tren END AS RpeTreningu,
         CzasPracy + r_czas_pracy AS CzasPracy,
         RpePracy + r_rpe_pracy AS RpePracy,
         HrRano - CAST(ROUND(4 * postep, 0) AS INT) + r_hr AS TetnoPoranne,
         (SenKwadranse + r_sen) * 0.25 AS Sen,
         Chec + CASE WHEN postep > 0.5 THEN 1 ELSE 0 END + r_chec AS ChecDoTreningu,
         CASE WHEN los_brak_tap < 20 THEN NULL
              ELSE Tapping + CAST(ROUND(4 * postep, 0) AS INT) + r_tap END AS Tapping
  FROM wiersze
  WHERE los_dzien < Czestosc
)
INSERT INTO Pomiary (UzytkownikId, Data, CzasTreningu, RpeTreningu, CzasPracy, RpePracy,
                     TetnoPoranne, Sen, ChecDoTreningu, Tapping)
SELECT UzytkownikId, Data,
       -- przycinanie do dozwolonych zakresów
       CASE WHEN CzasTreningu < 0 THEN 0 WHEN CzasTreningu > 300 THEN 300 ELSE CzasTreningu END,
       CASE WHEN RpeTreningu < 0 THEN 0 WHEN RpeTreningu > 10 THEN 10 ELSE RpeTreningu END,
       CASE WHEN CzasPracy < 0 THEN 0 WHEN CzasPracy > 720 THEN 720 ELSE CzasPracy END,
       CASE WHEN RpePracy < 0 THEN 0 WHEN RpePracy > 10 THEN 10 ELSE RpePracy END,
       CASE WHEN TetnoPoranne < 35 THEN 35 WHEN TetnoPoranne > 110 THEN 110 ELSE TetnoPoranne END,
       CASE WHEN Sen < 3 THEN 3.0 WHEN Sen > 11 THEN 11.0 ELSE Sen END,
       CASE WHEN ChecDoTreningu < 1 THEN 1 WHEN ChecDoTreningu > 5 THEN 5 ELSE ChecDoTreningu END,
       CASE WHEN Tapping < 20 THEN 20 WHEN Tapping > 120 THEN 120 ELSE Tapping END
FROM policzone;

-- Podsumowanie
SELECT k.Nazwa AS Komorka, COUNT(DISTINCT u.Id) AS Osob, COUNT(p.Id) AS Wpisow
FROM Uzytkownicy u
JOIN @osoby o ON o.Pseudonim = u.Pseudonim
JOIN Komorki k ON k.Id = u.KomorkaId
LEFT JOIN Pomiary p ON p.UzytkownikId = u.Id
GROUP BY k.Nazwa ORDER BY k.Nazwa;

SELECT COUNT(*) AS WpisowLacznie,
       AVG(ObciazenieTreningowe) AS SrObcTreningowe,
       AVG(ObciazeniePraca) AS SrObcPraca
FROM Pomiary p JOIN Uzytkownicy u ON u.Id = p.UzytkownikId JOIN @osoby o ON o.Pseudonim = u.Pseudonim;
GO
