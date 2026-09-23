-- Przykładowe dane: 40 użytkowników w 10 komórkach, pomiary z ostatnich 90 dni.
-- Skrypt można uruchamiać wielokrotnie - najpierw usuwa poprzednie dane przykładowe.
-- Uruchomienie: sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/przyklad.sql
USE PomiaryDB;
GO
SET NOCOUNT ON;

DECLARE @DNI INT = 90;  -- ile dni wstecz sięgają pomiary

-- Profil każdej osoby: wartości wyjściowe (sprzed @DNI dni) i jak często ćwiczy (% dni z pomiarem)
DECLARE @osoby TABLE (
  Pseudonim NVARCHAR(50), Komorka NVARCHAR(100),
  HrSpocz INT, HrWys INT, Skurcz INT, Rozkurcz INT, Czas INT, Rpe INT, Czestosc INT
);
INSERT INTO @osoby VALUES
  -- Kadra
  (N'kpt_zielinski',    N'Kadra',     58, 150, 124, 80, 45, 13, 55),
  (N'sierz_wojcik',     N'Kadra',     72, 168, 138, 88, 30, 16, 35),
  (N'por_adamczyk',     N'Kadra',     61, 154, 126, 81, 40, 14, 45),
  (N'chor_lewandowski', N'Kadra',     70, 166, 136, 87, 25, 16, 25),
  -- Pluton 1
  (N'marek_k',          N'Pluton 1',  66, 162, 126, 82, 35, 15, 60),
  (N'tomek92',          N'Pluton 1',  61, 155, 120, 78, 40, 14, 70),
  (N'dawid_w',          N'Pluton 1',  74, 174, 134, 86, 25, 17, 40),
  (N'kamil_s',          N'Pluton 1',  63, 157, 122, 79, 45, 13, 65),
  (N'olek',             N'Pluton 1',  69, 165, 129, 83, 30, 15, 50),
  -- Pluton 2
  (N'ania_w',           N'Pluton 2',  70, 170, 115, 74, 30, 15, 50),
  (N'bartek',           N'Pluton 2',  75, 178, 132, 86, 25, 17, 40),
  (N'kuba_s',           N'Pluton 2',  63, 158, 122, 79, 40, 14, 65),
  (N'natalia_p',        N'Pluton 2',  72, 172, 113, 73, 35, 15, 55),
  -- Pluton 3
  (N'ola_m',            N'Pluton 3',  68, 166, 112, 72, 30, 15, 55),
  (N'piotr_z',          N'Pluton 3',  60, 152, 128, 82, 50, 13, 75),
  (N'filip_r',          N'Pluton 3',  71, 169, 131, 85, 30, 16, 45),
  (N'zosia',            N'Pluton 3',  74, 175, 117, 75, 25, 16, 35),
  -- Pluton 4
  (N'krzysiek',         N'Pluton 4',  78, 180, 140, 90, 20, 18, 30),
  (N'mateusz_b',        N'Pluton 4',  64, 159, 124, 80, 40, 14, 60),
  (N'iga_k',            N'Pluton 4',  70, 168, 114, 73, 35, 15, 50),
  -- Pluton 5
  (N'magda_l',          N'Pluton 5',  65, 160, 118, 76, 35, 14, 60),
  (N'michal_d',         N'Pluton 5',  69, 164, 130, 84, 30, 15, 45),
  (N'wojtek_s',         N'Pluton 5',  76, 177, 137, 88, 20, 17, 25),
  (N'ala_n',            N'Pluton 5',  67, 163, 116, 74, 40, 14, 55),
  -- Pluton 6
  (N'rafal_p',          N'Pluton 6',  62, 156, 125, 80, 45, 14, 70),
  (N'szymon_t',         N'Pluton 6',  73, 171, 133, 86, 25, 16, 35),
  (N'karolina_j',       N'Pluton 6',  68, 165, 115, 74, 35, 15, 60),
  -- Pluton 7
  (N'ewa_k',            N'Pluton 7',  67, 163, 116, 75, 35, 15, 50),
  (N'adrian_m',         N'Pluton 7',  64, 158, 123, 79, 40, 14, 65),
  (N'julia_w',          N'Pluton 7',  71, 170, 112, 72, 30, 16, 45),
  (N'pawel_g',          N'Pluton 7',  77, 179, 139, 89, 20, 18, 20),
  -- Pluton 8
  (N'damian',           N'Pluton 8',  73, 172, 134, 87, 25, 16, 40),
  (N'monika_z',         N'Pluton 8',  66, 161, 117, 76, 35, 15, 55),
  (N'grzes',            N'Pluton 8',  70, 167, 128, 83, 30, 15, 30),
  -- Pluton 9
  (N'lukasz_c',         N'Pluton 9',  65, 160, 127, 81, 40, 14, 60),
  (N'sandra_b',         N'Pluton 9',  69, 166, 114, 73, 35, 15, 50),
  (N'hubert_k',         N'Pluton 9',  75, 176, 135, 88, 25, 17, 30),
  (N'norbert_s',        N'Pluton 9',  62, 155, 121, 78, 45, 13, 70),
  -- nowi, jeszcze bez pomiarów
  (N'patryk_n',         N'Pluton 9',  70, 168, 126, 81, 30, 15,  0),
  (N'nowy_rekrut',      N'Pluton 4',  72, 170, 128, 82, 30, 15,  0);

-- 1. Usuń poprzednie dane przykładowe
DELETE p FROM Pomiary p
JOIN Uzytkownicy u ON u.Id = p.UzytkownikId
JOIN @osoby o ON o.Pseudonim = u.Pseudonim;
DELETE u FROM Uzytkownicy u JOIN @osoby o ON o.Pseudonim = u.Pseudonim;

-- 2. Użytkownicy
INSERT INTO Uzytkownicy (Pseudonim, KomorkaId, Rola)
SELECT o.Pseudonim, k.Id, 'user'
FROM @osoby o JOIN Komorki k ON k.Nazwa = o.Komorka;

-- 3. Pomiary: dni 1..@DNI wstecz, losowo wg częstości; z czasem lekka poprawa kondycji
;WITH dni AS (
  SELECT TOP (@DNI) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS d FROM sys.all_objects
),
wiersze AS (
  SELECT u.Id AS UzytkownikId, o.*, dn.d,
         (CAST(@DNI AS DECIMAL(9,2)) - dn.d) / @DNI AS postep,                -- 0 najstarszy dzień, ~1 wczoraj
         ABS(CHECKSUM(NEWID())) % 100 AS los_dzien,
         ABS(CHECKSUM(NEWID())) % 660 AS los_minuta,                          -- 7:00-18:00
         ABS(CHECKSUM(NEWID())) % 7  - 3 AS r_hs,
         ABS(CHECKSUM(NEWID())) % 13 - 6 AS r_hw,
         ABS(CHECKSUM(NEWID())) % 11 - 5 AS r_sk,
         ABS(CHECKSUM(NEWID())) % 9  - 4 AS r_rk,
         ABS(CHECKSUM(NEWID())) % 4      AS r_spo,
         ABS(CHECKSUM(NEWID())) % 11 - 5 AS r_cz,
         ABS(CHECKSUM(NEWID())) % 3  - 1 AS r_rpe,
         ABS(CHECKSUM(NEWID())) % 100 AS los_brak                             -- czasem brak ciśnieniomierza
  FROM @osoby o
  JOIN Uzytkownicy u ON u.Pseudonim = o.Pseudonim
  CROSS JOIN dni dn
)
INSERT INTO Pomiary (UzytkownikId, Data, TetnoSpoczynek, TetnoWysilek, CisnienieSkurcz,
                     CisnienieRozkurcz, SpO2, CzasMin, RPE)
SELECT UzytkownikId,
       DATEADD(MINUTE, 420 + los_minuta, CAST(CAST(DATEADD(DAY, -d, GETDATE()) AS DATE) AS DATETIME)),
       HrSpocz - CAST(ROUND(6 * postep, 0) AS INT) + r_hs,
       HrWys - CAST(ROUND(14 * postep, 0) AS INT) + r_hw,
       CASE WHEN los_brak < 12 THEN NULL ELSE Skurcz - CAST(ROUND(5 * postep, 0) AS INT) + r_sk END,
       CASE WHEN los_brak < 12 THEN NULL ELSE Rozkurcz - CAST(ROUND(3 * postep, 0) AS INT) + r_rk END,
       96 + r_spo,
       CASE WHEN Czas + CAST(ROUND(15 * postep, 0) AS INT) + r_cz < 10 THEN 10
            ELSE Czas + CAST(ROUND(15 * postep, 0) AS INT) + r_cz END,
       CASE WHEN Rpe - CAST(ROUND(3 * postep, 0) AS INT) + r_rpe < 6 THEN 6
            WHEN Rpe - CAST(ROUND(3 * postep, 0) AS INT) + r_rpe > 20 THEN 20
            ELSE Rpe - CAST(ROUND(3 * postep, 0) AS INT) + r_rpe END
FROM wiersze
WHERE los_dzien < Czestosc;

-- Podsumowanie
SELECT k.Nazwa AS Komorka, COUNT(DISTINCT u.Id) AS Osob, COUNT(p.Id) AS Pomiarow
FROM Uzytkownicy u
JOIN @osoby o ON o.Pseudonim = u.Pseudonim
JOIN Komorki k ON k.Id = u.KomorkaId
LEFT JOIN Pomiary p ON p.UzytkownikId = u.Id
GROUP BY k.Nazwa
ORDER BY k.Nazwa;

SELECT COUNT(*) AS PomiarowLacznie FROM Pomiary p
JOIN Uzytkownicy u ON u.Id = p.UzytkownikId JOIN @osoby o ON o.Pseudonim = u.Pseudonim;
GO
