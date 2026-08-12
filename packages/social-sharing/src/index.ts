export type { WatermarkConfig, SocialPost } from './service';
export {
  defaultWatermark,
  shareMedia,
  shareMediaWithFile,
  applyWatermark,
  getShareUrl,
  getSocialPosts,
  addSocialPost,
  fetchOEmbed,
} from './service';

export type { SharePlatform, BrandHandle, ShareTagInput } from './share-with-tags';
export { buildShareText, buildShareUrl, buildShareTextForInstagram } from './share-with-tags';
