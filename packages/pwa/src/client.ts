'use client';

/** Client-only surface of @breezebox/pwa. */

export { useServiceWorker, clearCachedPages, type UpdateState } from './register';
export {
  useInstallPrompt,
  isIosSafari,
  isStandalone,
  type InstallState,
} from './install';
export { useCaptureQueue, clearDeviceData, type QueueState } from './sync';
export {
  enqueueCapture,
  listCaptures,
  removeCapture,
  clearCaptureQueue,
  flushCaptureQueue,
  purgeExpiredCaptures,
  capturesNeedingWarning,
  registerCaptureUploader,
  type CaptureItem,
  type NewCapture,
  type CaptureUploader,
} from './queue';
