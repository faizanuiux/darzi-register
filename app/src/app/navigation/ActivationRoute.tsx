import { useEffect } from 'react';
import { useActivation } from '../../features/activation/hooks/useActivation';
import { ActivationScreen } from '../../features/activation/screens/ActivationScreen';
import { useStrings } from '../../core/i18n/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

type Props = NativeStackScreenProps<RootStackParamList, 'Activation'>;

/**
 * Activation route: runs the license gate hook and renders the activation UI.
 * On successful activation, replaces the stack with Main.
 */
export function ActivationRoute({ navigation }: Props) {
  const activation = useActivation();
  const s = useStrings();

  useEffect(() => {
    if (activation.status === 'active') {
      navigation.replace('Main');
    }
  }, [activation.status, navigation]);

  return (
    <ActivationScreen
      activation={activation}
      strings={s}
      onActivated={() => navigation.replace('Main')}
    />
  );
}
