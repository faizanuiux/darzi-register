import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen';
import type { SettingsStackParamList } from './types';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

/**
 * Settings route: renders the settings screen; the screen wires itself to
 * i18n, theme, and the licensing service.
 */
export function SettingsRoute({ navigation }: Props) {
  return (
    <SettingsScreen
      onOpenImportExport={() => navigation.navigate('ImportExport', {})}
    />
  );
}
