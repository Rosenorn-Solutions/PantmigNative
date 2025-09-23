import React from 'react';
import { Pressable, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

export type PressableButtonProps = {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  iconName?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle | ((state: { pressed: boolean }) => ViewStyle);
};

export function PressableButton({
  title,
  onPress,
  color = '#2563eb',
  disabled,
  iconName,
  accessibilityLabel,
  testID,
  style,
}: PressableButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={(state) => {
        const base: ViewStyle = {
          backgroundColor: color,
          opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
        };
        if (typeof style === 'function') return { ...base, ...style(state) };
        if (style) return { ...base, ...style };
        return base;
      }}
    >
      {iconName ? <Ionicons name={iconName as any} size={18} color="#fff" style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: '#fff', fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export default PressableButton;
