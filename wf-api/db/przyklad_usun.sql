-- Usuwa dane przykładowe dodane skryptem przyklad.sql (nie rusza pozostałych użytkowników).
USE PomiaryDB;
GO
SET NOCOUNT ON;

DECLARE @przyklad TABLE (Pseudonim NVARCHAR(50));
INSERT INTO @przyklad VALUES
  (N'kpt_zielinski'), (N'sierz_wojcik'), (N'marek_k'), (N'tomek92'), (N'ania_w'), (N'bartek'),
  (N'kuba_s'), (N'ola_m'), (N'piotr_z'), (N'krzysiek'), (N'magda_l'), (N'michal_d'),
  (N'rafal_p'), (N'ewa_k'), (N'damian'), (N'patryk_n');

DELETE p FROM Pomiary p
JOIN Uzytkownicy u ON u.Id = p.UzytkownikId
JOIN @przyklad x ON x.Pseudonim = u.Pseudonim;
DELETE u FROM Uzytkownicy u JOIN @przyklad x ON x.Pseudonim = u.Pseudonim;
PRINT 'Usunięto dane przykładowe.';
GO
