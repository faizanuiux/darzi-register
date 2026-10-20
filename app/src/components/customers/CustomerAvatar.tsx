import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { useTheme } from '../../core/theme/ThemeProvider';

interface CustomerAvatarProps {
  photoPath?: string | null;
  name: string;
  /** Diameter in dp. */
  size?: number;
  style?: StyleProp<ImageStyle>;
}

/** Customer photo with an initials fallback when no photo is set. */
export function CustomerAvatar({ photoPath, name, size = 48, style }: CustomerAvatarProps) {
  const { theme } = useTheme();
  const { colors, fontSize, fontFamily } = theme;

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');

  const shape = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (photoPath) {
    return (
      <Image
        source={{ uri: photoPath }}
        style={[styles.image, shape, { backgroundColor: colors.primarySoft }, style]}
        accessibilityLabel={name}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        shape,
        { backgroundColor: colors.primarySoft },
        style,
      ]}>
      <Text
        style={{
          color: colors.primaryText,
          fontSize: size > 64 ? fontSize.xl : fontSize.md,
          fontFamily: fontFamily.bold,
        }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
