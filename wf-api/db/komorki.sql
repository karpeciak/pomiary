-- Dodatkowe komórki organizacyjne (łącznie 10). Skrypt można uruchomić wielokrotnie.
USE PomiaryDB;
GO
INSERT INTO Komorki (Nazwa)
SELECT v.Nazwa FROM (VALUES
  (N'Pluton 3'), (N'Pluton 4'), (N'Pluton 5'), (N'Pluton 6'),
  (N'Pluton 7'), (N'Pluton 8'), (N'Pluton 9')
) AS v(Nazwa)
WHERE NOT EXISTS (SELECT 1 FROM Komorki k WHERE k.Nazwa = v.Nazwa);
GO
