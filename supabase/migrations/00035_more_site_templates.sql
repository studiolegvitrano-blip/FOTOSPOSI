-- Amplia la gamma di template del site builder: gli sposi vedono un'anteprima di
-- esempio per ciascuno (palette + font) e scelgono quello che preferiscono.
-- ON CONFLICT assente: site_templates non ha vincolo unique sul nome, quindi
-- proteggiamo con WHERE NOT EXISTS per rendere la migrazione ri-eseguibile.
INSERT INTO site_templates (name, palette, font_family, category)
SELECT v.name, v.palette, v.font_family, v.category
FROM (VALUES
  ('Eleganza Classica', ARRAY['#b08d57','#fdfbf7','#2b2b2b','#ffffff'], 'Playfair Display, serif', 'classic'),
  ('Romantico Rosa',    ARRAY['#d48ea6','#fdf2f6','#5a3d47','#ffffff'], 'Lora, serif', 'romantic'),
  ('Vigneto Toscano',   ARRAY['#7d8c5c','#f7f5ee','#3f4a33','#ffffff'], 'Cormorant Garamond, serif', 'rustic'),
  ('Notte Stellata',    ARRAY['#e6c56a','#141a2e','#f5f0e6','#1f2740'], 'Playfair Display, serif', 'elegant'),
  ('Limoni di Amalfi',  ARRAY['#e8b830','#f2f8fb','#1f4e6b','#ffffff'], 'Montserrat, sans-serif', 'beach'),
  ('Minimal Bianco',    ARRAY['#9a9a9a','#ffffff','#222222','#f7f7f7'], 'Inter, sans-serif', 'modern')
) AS v(name, palette, font_family, category)
WHERE NOT EXISTS (SELECT 1 FROM site_templates st WHERE st.name = v.name);
