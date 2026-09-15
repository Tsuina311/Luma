import { router } from 'expo-router';

/** Leave a modal/detail screen without throwing when there is no stack history (common on web). */
export function dismissScreen(fallback: '/' | string = '/') {
  if (typeof router.canDismiss === 'function' && router.canDismiss()) {
    router.dismiss();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback as never);
}
