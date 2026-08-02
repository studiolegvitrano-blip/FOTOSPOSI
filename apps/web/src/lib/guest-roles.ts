/**
 * Ruoli dei partecipanti relativi al matrimonio (core_users.role_at_event).
 *
 * L'utente ha deciso che SOLO questi ruoli appaiono in galleria sotto la foto del
 * caricatore: Testimone della sposa, Testimone dello sposo, Padre, Madre.
 * Gli altri ruoli raccolti in fase di registrazione (Amico, Parente, Collega,
 * Altro personalizzato) restano salvati su core_users.role_at_event — servono
 * nelle liste "Partecipanti" delle impostazioni — ma NON vengono mostrati nel feed.
 */

/** Ruoli che il feed galleria mostra sotto il nome del caricatore. */
export const GALLERY_VISIBLE_ROLES = [
  'testimone-sposa',
  'testimone-sposo',
  'padre',
  'madre',
] as const;

export type GalleryVisibleRole = (typeof GALLERY_VISIBLE_ROLES)[number];

/** Tutti i ruoli selezionabili in fase di registrazione (onboarding OAuth). */
export const REGISTRATION_ROLES: { value: string; label: string; galleryVisible?: boolean }[] = [
  { value: 'testimone-sposa', label: 'Testimone della sposa', galleryVisible: true },
  { value: 'testimone-sposo', label: 'Testimone dello sposo', galleryVisible: true },
  { value: 'padre', label: 'Padre', galleryVisible: true },
  { value: 'madre', label: 'Madre', galleryVisible: true },
  { value: 'amico', label: 'Amico' },
  { value: 'parente', label: 'Parente' },
  { value: 'altro', label: 'Altro (specifica)' },
];

/** True se il ruolo deve apparire nel feed galleria. */
export function isGalleryVisibleRole(role: string | null | undefined): boolean {
  return !!role && (GALLERY_VISIBLE_ROLES as readonly string[]).includes(role);
}
