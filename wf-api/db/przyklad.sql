-- Przykładowe dane: 16 użytkowników w różnych komórkach, pomiary z ostatnich 30 dni.
-- Skrypt można uruchamiać wielokrotnie - najpierw usuwa poprzednie dane przykładowe.
-- Uruchomienie: sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/przyklad.sql
USE PomiaryDB;
GO
SET NOCOUNT ON;

-- Profil każdej osoby: wartości wyjściowe (sprzed miesiąca) i jak często ćwiczy (% dni z pomiarem)
DECLARE @osoby TABLE (
  Pseudonim NVARCHAR(50), Komorka NVARCHAR(100),
  HrSpocz INT, HrWys INT, Skurcz INT, Rozkurcz INT, Czas INT, Rpe INT, Czestosc INT
);
INSERT INTO @osoby VALUES
  (N'kpt_zielinski', N'Kadra',     58, 150, 124, 80, 45, 13, 55),
  (N'sierz_wojcik',  N'Kadra',     72, 168, 138, 88, 30, 16, 35),
  (N'marek_k',       N'Pluton 1',  66, 162, 126, 82, 35, 15, 60),
  (N'tomek92',       N'Pluton 1',  61, 155, 120, 78, 40, 14, 70),
  (N'ania_w',        N'Pluton 2',  70, 170, 115, 74, 30, 15, 50),
  (N'bartek',        N'Pluton 2',  75, 178, 132, 86, 25, 17, 40),
  (N'kuba_s',        N'Pluton 2',  63, 158, 122, 79, 40, 14, 65),
  (N'ola_m',         N'Pluton 3',  68, 166, 112, 72, 30, 15, 55),
  (N'piotr_z',       N'Pluton 3',  60, 152, 128, 82, 50, 13, 75),
  (N'krzysiek',      N'Pluton 4',  78, 180, 140, 90, 20, 18, 30),
  (N'magda_l',       N'Pluton 5',  65, 160, 118, 76, 35, 14, 60),
  (N'michal_d',      N'Pluton 5',  69, 164, 130, 84, 30, 15, 45),
  (N'rafal_p',       N'Pluton 6',  62, 156, 125, 80, 45, 14, 70),
  (N'ewa_k',         N'Pluton 7',  67, 163, 116, 75, 35, 15, 50),
  (N'damian',        N'Pluton 8',  73, 172, 134, 87, 25, 16, 40),
  (N'patryk_n',      N'Pluton 9',  70, 168, 126, 81, 30, 15,  0);  -- nowa osoba, jeszcze bez pomiarów

-- 1. Usuń poprzednie dane przykładowe
DELETE p FROM Pomiary p
JOIN Uzytkownicy u ON u.Id = p.UzytkownikId
JOIN @osoby o ON o.Pseudonim = u.Pseudonim;
DELETE u FROM Uzytkownicy u JOIN @osoby o ON o.Pseudonim = u.Pseudonim;

-- 2. Użytkownicy
INSERT INTO Uzytkownicy (Pseudonim, KomorkaId, Rola)
SELECT o.Pseudonim, k.Id, 'user'
FROM @osoby o JOIN Komorki k ON k.Nazwa = o.Komorka;

-- 3. Pomiary: dni 1..30 wstecz, losowo wg częstości; z czasem lekka poprawa kondycji
;WITH dni AS (
  SELECT TOP (30) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS d FROM sys.all_objects
),
wiersze AS (
  SELECT u.Id AS UzytkownikId, o.*, dn.d,
         (30.0 - dn.d) / 30.0 AS postep,                                   -- 0 miesiąc temu, ~1 wczoraj
         ABS(CHECKSUM(NEWID())) % 100 AS los_dzien,
         ABS(CHECKSUM(NEWID())) % 660 AS los_minuta,                       -- 7:00-18:00
         ABS(CHECKSUM(NEWID())) % 7  - 3 AS r_hs,
         ABS(CHECKSUM(NEWID())) % 13 - 6 AS r_hw,
         ABS(CHECKSUM(NEWID())) % 11 - 5 AS r_sk,
         ABS(CHECKSUM(NEWID())) % 9  - 4 AS r_rk,
         ABS(CHECKSUM(NEWID())) % 4      AS r_spo,
         ABS(CHECKSUM(NEWID())) % 11 - 5 AS r_cz,
         ABS(CHECKSUM(NEWID())) % 3  - 1 AS r_rpe,
         ABS(CHECKSUM(NEWID())) % 100 AS los_brak                          -- czasem brak ciśnieniomierza
  FROM @osoby o
  JOIN Uzytkownicy u ON u.Pseudonim = o.Pseudonim
  CROSS JOIN dni dn
)
INSERT INTO Pomiary (UzytkownikId, Data, TetnoSpoczynek, TetnoWysilek, CisnienieSkurcz,
                     CisnienieRozkurcz, SpO2, CzasMin, RPE)
SELECT UzytkownikId,
       DATEADD(MINUTE, 420 + los_minuta, CAST(CAST(DATEADD(DAY, -d, GETDATE()) AS DATE) AS DATETIME)),
       HrSpocz - CAST(ROUND(4 * postep, 0) AS INT) + r_hs,
       HrWys - CAST(ROUND(10 * postep, 0) AS INT) + r_hw,
       CASE WHEN los_brak < 12 THEN NULL ELSE Skurcz - CAST(ROUND(3 * postep, 0) AS INT) + r_sk END,
       CASE WHEN los_brak < 12 THEN NULL ELSE Rozkurcz + r_rk END,
       96 + r_spo,
       CASE WHEN Czas + CAST(ROUND(10 * postep, 0) AS INT) + r_cz < 10 THEN 10
            ELSE Czas + CAST(ROUND(10 * postep, 0) AS INT) + r_cz END,
       CASE WHEN Rpe - CAST(ROUND(2 * postep, 0) AS INT) + r_rpe < 6 THEN 6
            WHEN Rpe - CAST(ROUND(2 * postep, 0) AS INT) + r_rpe > 20 THEN 20
            ELSE Rpe - CAST(ROUND(2 * postep, 0) AS INT) + r_rpe END
FROM wiersze
WHERE los_dzien < Czestosc;

-- Podsumowanie
SELECT k.Nazwa AS Komorka, u.Pseudonim, COUNT(p.Id) AS Pomiarow,
       CONVERT(VARCHAR(10), MIN(p.Data), 104) AS Od, CONVERT(VARCHAR(10), MAX(p.Data), 104) AS Do
FROM Uzytkownicy u
JOIN @osoby o ON o.Pseudonim = u.Pseudonim
JOIN Komorki k ON k.Id = u.KomorkaId
LEFT JOIN Pomiary p ON p.UzytkownikId = u.Id
GROUP BY k.Nazwa, u.Pseudonim
ORDER BY k.Nazwa, u.Pseudonim;
GO
