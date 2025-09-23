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
  iconPosition?: 'left' | 'right';
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
  iconPosition = 'left',
  accessibilityLabel,
  testID,
  style,
}: PressableButtonProps) {
  const renderIcon = (pos: 'left' | 'right') => (
    <FontAwesome6
      name={iconName as any}
      size={18}
      color="#fff"
      style={{ marginRight: pos === 'left' ? 6 : 0, marginLeft: pos === 'right' ? 6 : 0 }}
    />
  );
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
      {iconName && iconPosition === 'left' ? renderIcon('left') : null}
      {/* {iconName ? <Ionicons name={iconName as any} size={18} color="#fff" style={{ marginRight: 6 }} /> : null} */}
      <Text style={{ color: '#fff', fontWeight: '600' }}>{title}</Text>
      {iconName && iconPosition === 'right' ? renderIcon('right') : null}
    </Pressable>
  );
}

export default PressableButton;
