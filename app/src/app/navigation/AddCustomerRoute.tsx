import { useMemo } from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CustomerEditorScreen } from '../../features/customer-editor/screens/CustomerEditorScreen';
import type { CustomerNav, MainTabsParamList } from './types';

type Props = BottomTabScreenProps<MainTabsParamList, 'Add'>;

/**
 * The "Add" tab hosts the customer editor in create mode. The editor only
 * calls navigation.goBack() (on save / discard), which is wrapped here to
 * return to the Customers tab instead of doing nothing.
 */
export function AddCustomerRoute({ navigation, route }: Props) {
  const nav = useMemo<CustomerNav>(
    () => ({
      goBack: () => navigation.navigate('Customers'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate: (...args: any[]) =>
        (navigation as any).navigate(...args),
    }),
    [navigation],
  );

  return (
    <CustomerEditorScreen
      navigation={nav}
      route={{ key: route.key, name: 'CustomerEditor', params: {} }}
    />
  );
}
