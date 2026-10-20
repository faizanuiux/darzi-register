/**
 * @format
 */

import { AppRegistry, Alert } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

/**
 * Last-resort global handler: catches JS errors that escape the React tree
 * (e.g. during bundle evaluation) and shows them instead of dying silently.
 * In release builds this prevents the instant "flash then close".
 */
const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  try {
    Alert.alert(
      'Startup problem',
      `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`,
      [{ text: 'OK' }],
    );
  } catch {
    // If even the alert fails, fall back to the default handler.
  }
  if (defaultHandler) {
    defaultHandler(error, isFatal);
  }
});

AppRegistry.registerComponent(appName, () => App);
