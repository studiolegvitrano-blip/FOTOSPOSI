ALTER TABLE marketplace_suppliers DROP CONSTRAINT IF EXISTS marketplace_suppliers_category_check;
ALTER TABLE marketplace_suppliers ADD CONSTRAINT marketplace_suppliers_category_check
  CHECK (category IN ('fotografo', 'catering', 'fiori', 'musica', 'location', 'abiti', 'torte', 'video', 'parrucchiere', 'estetista', 'autonoleggio', 'makeup', 'wedding_planner', 'animazione', 'servizio_consigliato', 'altro'));

ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS affiliate_link TEXT;
ALTER TABLE marketplace_suppliers ADD COLUMN IF NOT EXISTS commission_info TEXT;

INSERT INTO marketplace_suppliers (name, category, description, city, approved, is_partner, slug, discount_offer, affiliate_link, commission_info) VALUES
  -- Fintech / Banche
  ('Revolut', 'servizio_consigliato', 'Conto corrente digitale multivaluta con cashback e assicurazione viaggi', NULL, true, true, 'revolut', 'Premium 1 mese gratis + cashback', 'https://revolut.com/invite/partner', 'Fino a 55€/invito + 20% commissione su abbonamenti Premium'),
  ('ING Italia', 'servizio_consigliato', 'Conto Corrente Arancio con canone zero e carta di credito inclusa', NULL, true, true, 'ing', '50€ di cashback all\'apertura', 'https://www.ing.it/partner/spositive', '50€ per ogni nuovo conto aperto, +250€ ogni 10'),
  ('UniCredit', 'servizio_consigliato', 'Conto My Genius con bonus benvenuto e gestione tutto incluso', NULL, true, true, 'unicredit', '150€ di bonus all\'apertura', 'https://www.unicredit.it/porta-un-amico', '50€ per presentatore, 150€ per presentato'),
  ('Tot', 'servizio_consigliato', 'Conto business per partite IVA e professionisti con carta VISA Business', NULL, true, true, 'tot', '6 mesi di canone gratis', 'https://tot.money/partner/spositive', '200-600€ per ogni partita IVA attivata'),
  ('Vivid', 'servizio_consigliato', 'Conto con cashback e interessi sulle liquidità', NULL, true, true, 'vivid', '20€ di bonus + 3% interesse per 60gg', 'https://vivid.money/invite/spositive', '20€ per ogni amico, massimo 100€'),
  ('Wise', 'servizio_consigliato', 'Bonifici internazionali a costo zero, cambio valuta reale', NULL, true, true, 'wise', 'Primo bonifico estero gratuito', 'https://wise.com/invite/partner', 'Commissione sul primo trasferimento'),
  ('BNL BNP Paribas', 'servizio_consigliato', 'Conto corrente con programma PAYBACK e carta di credito', NULL, true, true, 'bnl', '50€ in Punti PAYBACK', 'https://bnl.it/partner/spositive', '50€ Punti PAYBACK per ogni nuovo conto'),

  -- Assicurazioni Viaggio
  ('Columbus Assicurazioni', 'servizio_consigliato', 'Assicurazione viaggio con le migliori commissioni del mercato italiano', NULL, true, true, 'columbus', 'Sconto 10% su polizze viaggio', 'https://www.columbusassicurazioni.it/affiliates', '13,5% su polizze viaggio singolo, 12,50€ su annuali'),
  ('IATI Assicurazioni', 'servizio_consigliato', 'Assicurazione viaggi con sconto del 5% per la tua community', NULL, true, true, 'iati', 'Sconto 5% per gli sposi', 'https://www.iatiassicurazioni.it/programma-di-affiliazione/', 'Commisione variabile, sconto 5% per il cliente'),
  ('World Nomads', 'servizio_consigliato', 'Assicurazione viaggio per viaggiatori avventurosi, copre attività sportive', NULL, true, true, 'world-nomads', '10% di sconto', 'https://worldnomads.com/affiliates', '10% per vendita, cookie 60gg'),

  -- E-commerce
  ('Amazon', 'servizio_consigliato', 'Il più grande e-commerce al mondo: acquisti di ogni tipo per la casa, regali, liste nozze', NULL, true, true, 'amazon', 'Link diretto Amazon per la lista nozze', 'https://amazon.it/associates', '1-6% su ogni acquisto, cookie 24h'),
  ('Shopify', 'servizio_consigliato', 'Crea il tuo e-commerce per vendere prodotti artigianali o bomboniere online', NULL, true, true, 'shopify', 'Trial gratuito 3 mesi', 'https://shopify.com/partners', 'Fino a 150$ per merchant, 2000$ per Shopify Plus'),

  -- Viaggi
  ('Booking.com', 'servizio_consigliato', 'Prenotazione hotel e strutture in tutto il mondo per la luna di miele', NULL, true, true, 'booking', '10% di sconto su prima prenotazione', 'https://booking.com/affiliates', '25-40% della commissione Booking'),
  ('Expedia', 'servizio_consigliato', 'Pacchetti viaggio, voli + hotel per la luna di miele', NULL, true, true, 'expedia', 'Coupon sconto esclusivo', 'https://expedia.com/affiliates', '2-11% sulle prenotazioni'),
  ('Airbnb', 'servizio_consigliato', 'Case vacanze ed esperienze uniche per la luna di miele', NULL, true, true, 'airbnb', 'Buono viaggio 50€', 'https://airbnb.com/affiliates', '25-30% della commissione Airbnb'),

  -- SaaS / Utility
  ('Enel Energia', 'servizio_consigliato', 'Offerte luce e gas per la nuova casa degli sposi', NULL, true, true, 'enel', '50€ di bonus sulla prima bolletta', 'https://enel.it/porta-un-amico', '50€ per ogni nuovo contratto'),
  ('Vodafone', 'servizio_consigliato', 'Fibra e mobile per la nuova casa', NULL, true, true, 'vodafone', 'Primi 3 mesi gratis su fibra', 'https://vodafone.it/partner/spositive', '30€ per ogni nuova attivazione'),
  ('Semrush', 'servizio_consigliato', 'Strumento di SEO e marketing digitale per promuovere il tuo business', NULL, true, true, 'semrush', 'Prova gratuita 14 giorni estesa', 'https://semrush.com/affiliates', '200$ flat per abbonamento, cookie 120gg'),
  ('WP Engine', 'servizio_consigliato', 'Hosting WordPress professionale per fotografi e wedding planner', NULL, true, true, 'wp-engine', '1 mese di hosting gratuito', 'https://wpengine.com/affiliates', '200$+ per referral, cookie 180gg'),
  ('Spotify', 'servizio_consigliato', 'Musica in streaming per il ricevimento, la cena e l\'after party — playlist collaborative', NULL, true, true, 'spotify', '3 mesi Premium gratis', 'https://spotify.com/affiliates', '$7,35 per vendita via Sovrn, 1 mese gratis per referral'),

  -- Autonoleggi
  ('Rentalcars.com', 'servizio_consigliato', 'Noleggio auto in Italia e all\'estero per il viaggio di nozze', NULL, true, true, 'rentalcars', '10% di sconto', 'https://rentalcars.com/affiliates', '6% del valore totale noleggio via CJ Affiliate'),
  ('Hertz', 'servizio_consigliato', 'Noleggio auto premium per gli sposi e gli invitati', NULL, true, true, 'hertz', '15% di sconto per gli sposi', 'https://hertz.com/affiliates', '5-10% per noleggio, cookie 30gg'),
  ('Avis', 'servizio_consigliato', 'Noleggio auto con copertura assicurativa inclusa', NULL, true, true, 'avis', 'Upgrade gratuito della categoria', 'https://avis.com/affiliates', '5% per noleggio, cookie 30gg'),
  ('Europcar', 'servizio_consigliato', 'Noleggio auto per trasporto invitati e viaggio di nozze', NULL, true, true, 'europcar', '20% di sconto', 'https://europcar.com/affiliates', '8% per noleggio, cookie 45gg');
