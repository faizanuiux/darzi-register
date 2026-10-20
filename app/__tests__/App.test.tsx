/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// @react-navigation ships untransformed ESM that jest cannot parse, so the
// navigation layer is stubbed here. Screen-level behaviour is covered by
// feature tests, not this smoke test.
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useNavigation: () => ({
    canGoBack: () => false,
    goBack: jest.fn(),
    navigate: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Screen: () => null,
  }),
}));

// The published package points at untransformed TS/ESM sources.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    executeAsync: jest.fn().mockResolvedValue({ rows: [] }),
  })),
}));

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-device-info', () => ({
  getAndroidId: jest.fn().mockResolvedValue('test-device-id'),
  getVersion: jest.fn(() => '1.0.0'),
  getManufacturer: jest.fn().mockResolvedValue('test'),
  getModel: jest.fn(() => 'test-model'),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp',
  TemporaryDirectoryPath: '/tmp',
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(''),
  exists: jest.fn().mockResolvedValue(false),
  unlink: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-share', () => ({
  default: { open: jest.fn().mockResolvedValue(undefined) },
  open: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-html-to-pdf', () => ({
  convert: jest.fn().mockResolvedValue({ filePath: '/tmp/test.pdf' }),
}));

import App from '../App';

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  expect(tree?.toJSON()).toBeTruthy();
});
