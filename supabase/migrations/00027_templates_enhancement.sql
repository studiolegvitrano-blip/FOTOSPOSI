ALTER TABLE site_templates ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'classic';

INSERT INTO site_templates (name, palette, font_family, category) VALUES
  ('Fiori di Campo', ARRAY['#c9a84c','#faf6f0','#3d3d3d','#ffffff'], 'Playfair Display, serif', 'floral'),
  ('Giardino Segreto', ARRAY['#8fbc8f','#f8faf5','#4a5d4a','#ffffff'], 'Lora, serif', 'garden'),
  ('Boho Chic', ARRAY['#d4a373','#fefae0','#5c4033','#ffffff'], 'Poppins, sans-serif', 'modern'),
  ('Moderno Scuro', ARRAY['#c0c0c0','#1a1a1a','#f0f0f0','#2d2d2d'], 'Inter, sans-serif', 'modern'),
  ('Costa Blu', ARRAY['#0077b6','#e0f7fa','#023e8a','#ffffff'], 'Montserrat, sans-serif', 'beach'),
  ('Tramonto', ARRAY['#e07a5f','#fff5e6','#3d405b','#ffffff'], 'Playfair Display, serif', 'classic');
