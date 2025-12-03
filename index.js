import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Global error handler to ensure errors visible in logs
try {
  const defaultHandler = global.ErrorUtils?.getGlobalHandler?.();
  global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    console.error('[GlobalErrorHandler]', { isFatal, message: error?.message });
    if (error?.stack) {
      console.error(error.stack);
    }
    if (typeof defaultHandler === 'function') {
      defaultHandler(error, isFatal);
    }
  });
} catch (e) {
  console.warn('Failed to set global error handler:', e);
}
