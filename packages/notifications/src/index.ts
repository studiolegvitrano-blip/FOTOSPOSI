export type NotificationChannel = 'email' | 'whatsapp' | 'push';

export type { NotificationPreference, NotificationLog } from './service';

export {
  getPreferences,
  updatePreference,
  sendNotification,
  getNotificationLog,
} from './service';

export type {
  WhatsAppProvider,
  ProviderNotConfiguredError,
  selectWhatsAppProvider,
  resetWhatsAppProviderForTests,
} from './providers/whatsapp';
