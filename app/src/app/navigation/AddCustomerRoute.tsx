import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { CustomerEditorScreen } from '../../features/customer-editor/screens/CustomerEditorScreen';
import type { CustomerNav, MainTabsParamList } from './types';

type Props = BottomTabScreenProps<MainTabsParamList, 'Add'>;

/**
 * The "Add" tab hosts the customer editor in create mode. The editor only
 * calls navigation.goBack() (on save / discard), which is wrapped here to
 * return to the Customers tab instead of doing nothing.
 *
 * Bottom-tab screens stay MOUNTED after their first visit, so without help
 * the editor would keep showing whatever was typed (or saved) last time —
 * the form looked like it was "editing" the previous customer. To guarantee
 * a blank create form on EVERY arrival, the editor is remounted with a
 * fresh key:
 * - each time this tab gains focus after the first visit, and
 * - when the Add tab is pressed while it is already focused (tabPress),
 *   where no focus change would otherwise occur.
 */
export function AddCustomerRoute({ navigation, route }: Props) {
  const [formKey, setFormKey] = useState(0);
  const focusedOnceRef = useRef(false);

  const resetForm = useCallback(() => {
    setFormKey((k) => k + 1);
  }, []);

  // Fresh blank form on every arrival at the Add tab. The first focus is
  // the initial mount (already blank), so only later arrivals remount.
  useFocusEffect(
    useCallback(() => {
      if (focusedOnceRef.current) {
        resetForm();
      } else {
        focusedOnceRef.current = true;
      }
    }, [resetForm]),
  );

  // Tapping "+" while already sitting on the Add tab emits tabPress but no
  // focus change — reset the form here too.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        resetForm();
      }
    });
    return unsubscribe;
  }, [navigation, resetForm]);

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
      key={formKey}
      navigation={nav}
      route={{ key: route.key, name: 'CustomerEditor', params: {} }}
    />
  );
}
