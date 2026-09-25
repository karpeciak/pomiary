-- Nowy zestaw parametrów: obciążenie treningowe i pracą (sRPE), regeneracja, gotowość.
-- Stare pomiary (tętno, ciśnienie, SpO2) trafiają do tabeli PomiaryArchiwum - tylko do odczytu.
-- Uruchomienie: sqlcmd -S "localhost\MSSQLSERVER04" -E -C -f 65001 -i wf-api/db/migracja-nowe-parametry.sql
USE PomiaryDB;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;   -- wymagane przez kolumny wyliczane PERSISTED
SET ANSI_NULLS ON;
SET XACT_ABORT ON;

IF OBJECT_ID('PomiaryArchiwum', 'U') IS NOT NULL
BEGIN
  PRINT 'Migracja była już wykonana (istnieje PomiaryArchiwum) - pomijam.';
  RETURN;
END

BEGIN TRAN;

-- 1. Stare pomiary do archiwum
EXEC sp_rename 'Pomiary', 'PomiaryArchiwum';

-- 2. Nowa tabela pomiarów
CREATE TABLE Pomiary (
  Id             INT IDENTITY PRIMARY KEY,
  UzytkownikId   INT NOT NULL REFERENCES Uzytkownicy(Id),
  Data           DATETIME NOT NULL DEFAULT GETDATE(),

  -- wprowadzane przez użytkownika
  CzasTreningu   INT           NULL CHECK (CzasTreningu   BETWEEN 0 AND 1440),  -- minuty
  RpeTreningu    INT           NULL CHECK (RpeTreningu    BETWEEN 0 AND 10),    -- Borg CR-10
  CzasPracy      INT           NULL CHECK (CzasPracy      BETWEEN 0 AND 1440),  -- minuty
  RpePracy       INT           NULL CHECK (RpePracy       BETWEEN 0 AND 10),
  TetnoPoranne   INT           NULL CHECK (TetnoPoranne   BETWEEN 20 AND 120),  -- ud./min
  Sen            DECIMAL(4, 2) NULL CHECK (Sen            BETWEEN 0 AND 12),    -- godziny, krok 0,25
  ChecDoTreningu INT           NULL CHECK (ChecDoTreningu BETWEEN 1 AND 5),     -- 5 buziek
  Tapping        INT           NULL CHECK (Tapping        BETWEEN 0 AND 500),   -- stuknięcia w 10 s

  -- wyliczane przez bazę (sRPE); NULL, gdy brakuje składnika
  ObciazenieTreningowe AS (CzasTreningu * RpeTreningu) PERSISTED,  -- AU
  ObciazeniePraca      AS (CzasPracy * RpePracy)       PERSISTED,  -- AU

  -- doba ma 24 h: trening i praca razem nie mogą jej przekroczyć
  CONSTRAINT CK_Pomiary_DobaMax CHECK (ISNULL(CzasTreningu, 0) + ISNULL(CzasPracy, 0) <= 1440)
);

CREATE INDEX IX_Pomiary_Uzytkownik_Data ON Pomiary (UzytkownikId, Data);

COMMIT;

SELECT 'PomiaryArchiwum' AS Tabela, COUNT(*) AS Rekordow FROM PomiaryArchiwum
UNION ALL
SELECT 'Pomiary', COUNT(*) FROM Pomiary;
GO
