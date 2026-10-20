
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Screens reachable before a license is active. */
export type RootStackParamList = {
  /** License activation gate. */
  Activation: undefined;
  /** The authenticated app: bottom tabs. */
  Main: NavigatorScreenParams<MainTabsParamList> | undefined;
};

/** Bottom tabs of the authenticated app. */
export type MainTabsParamList = {
  /** Customer stack: list → details → editor. */
  Customers: undefined;
  /** Customer editor in create mode. */
  Add: undefined;
  /** Settings stack: settings → import/export. */
  SettingsTab: undefined;
};

/** Stack inside the Customers tab. */
export type CustomersStackParamList = {
  CustomerList: undefined;
  CustomerDetails: { customerId: string };
  /** customerId omitted = create mode; present = edit mode. */
  CustomerEditor: { customerId?: string };
};

/** Stack inside the Settings tab. */
export type SettingsStackParamList = {
  Settings: undefined;
  ImportExport: { customerId?: string };
};

/**
 * Screen props shared by every customer screen. The navigation shape is
 * structural (not tied to one navigator type) so the editor can also be
 * hosted directly in a tab with a wrapped `goBack`. `navigate` is loosely
 * typed on purpose — call sites pass the same route names/params as before.
 */
export interface CustomerNav {
  goBack(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigate(...args: any[]): void;
}

export interface CustomerRoute<P> {
  key: string;
  name: string;
  params?: P;
}

export interface CustomerListScreenProps {
  navigation: CustomerNav;
  route: CustomerRoute<undefined>;
}

export interface CustomerDetailsScreenProps {
  navigation: CustomerNav;
  route: CustomerRoute<{ customerId: string }>;
}

export interface CustomerEditorScreenProps {
  navigation: CustomerNav;
  route: CustomerRoute<{ customerId?: string } | undefined>;
}

/** Navigator-level prop types (for the navigator components themselves). */
export type RootStackProps = NativeStackScreenProps<RootStackParamList>;
export type CustomersStackProps = NativeStackScreenProps<CustomersStackParamList>;
export type SettingsStackProps = NativeStackScreenProps<SettingsStackParamList>;

export type SettingsTabProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, 'SettingsTab'>,
  NativeStackScreenProps<SettingsStackParamList>
>;
