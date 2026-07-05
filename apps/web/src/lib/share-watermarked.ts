'use client';

// Condivide (o scarica, se il browser non supporta Web Share con file) il media già
// brandizzato col logo/watermark lato server (`/api/photos/[id]/share`), invece di condividere
// solo il link. Usato sia dalla galleria evento sia dal Video Guestbook.
export async function shareWatermarkedMedia(
  mediaId: string,
  eventId: string,
  isVideo: boolean,
  title: string,
): Promise<boolean> {
  const url = `/api/photos/${mediaId}/share?eventId=${eventId}&format=story`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('download fallito');
    const blob = await resp.blob();
    const ext = isVideo ? 'mp4' : 'jpg';
    const type = isVideo ? 'video/mp4' : 'image/jpeg';
    const file = new File([blob], `fotosposi.${ext}`, { type });

    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      try {
        await nav.share({ title, files: [file] });
        return true;
      } catch {
        // utente ha annullato la share sheet, o non supportata per i file: scarica invece
      }
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = `fotosposi.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch {
    alert('Condivisione non riuscita, riprova.');
    return false;
  }
}
