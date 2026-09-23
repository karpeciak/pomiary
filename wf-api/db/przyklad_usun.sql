-- Usuwa dane przykładowe dodane skryptem przyklad.sql (nie rusza pozostałych użytkowników).
USE PomiaryDB;
GO
SET NOCOUNT ON;

DECLARE @przyklad TABLE (Pseudonim NVARCHAR(50));
INSERT INTO @przyklad VALUES
  (N'kpt_zielinski'), (N'sierz_wojcik'), (N'por_adamczyk'), (N'chor_lewandowski'),
  (N'marek_k'), (N'tomek92'), (N'dawid_w'), (N'kamil_s'), (N'olek'),
  (N'ania_w'), (N'bartek'), (N'kuba_s'), (N'natalia_p'),
  (N'ola_m'), (N'piotr_z'), (N'filip_r'), (N'zosia'),
  (N'krzysiek'), (N'mateusz_b'), (N'iga_k'),
  (N'magda_l'), (N'michal_d'), (N'wojtek_s'), (N'ala_n'),
  (N'rafal_p'), (N'szymon_t'), (N'karolina_j'),
  (N'ewa_k'), (N'adrian_m'), (N'julia_w'), (N'pawel_g'),
  (N'damian'), (N'monika_z'), (N'grzes'),
  (N'lukasz_c'), (N'sandra_b'), (N'hubert_k'), (N'norbert_s'),
  (N'patryk_n'), (N'nowy_rekrut');

DELETE p FROM Pomiary p
JOIN Uzytkownicy u ON u.Id = p.UzytkownikId
JOIN @przyklad x ON x.Pseudonim = u.Pseudonim;
DELETE u FROM Uzytkownicy u JOIN @przyklad x ON x.Pseudonim = u.Pseudonim;
PRINT 'Usunięto dane przykładowe.';
GO
