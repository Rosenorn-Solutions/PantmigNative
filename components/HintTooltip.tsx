import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

export type HintTooltipProps = {
  message: string;
  iconName?: React.ComponentProps<typeof FontAwesome6>['name'];
  color?: string;
  size?: number;
  // Placement relative to the icon
  placement?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  // Optional style overrides
  containerStyle?: any;
  tooltipStyle?: any;
};

export default function HintTooltip(props: Readonly<HintTooltipProps>) {
  const {
    message,
    iconName = 'circle-question',
    color = '#6b7280',
    size = 14,
    placement = 'top-right',
    containerStyle,
    tooltipStyle,
  } = props;
  const [visible, setVisible] = React.useState(false);

  const positionStyle = React.useMemo(() => {
    const base: any = { position: 'absolute', zIndex: 100 };
    if (placement === 'top-right') return { ...base, bottom: size + 6, left: size + 6 };
    if (placement === 'bottom-right') return { ...base, top: size + 6, left: size + 6 };
    if (placement === 'top-left') return { ...base, bottom: size + 6, right: size + 6 };
    return { ...base, top: size + 6, right: size + 6 };
  }, [placement, size]);

  return (
    <View style={[{ position: 'relative', zIndex: 100 }, containerStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vis hjælp"
        onPress={() => setVisible(v => !v)}
        // Web hover support; ignored on native
        onHoverIn={() => setVisible(true) as any}
        onHoverOut={() => setVisible(false) as any}
        style={{ padding: 2 }}
      >
        <FontAwesome6 name={iconName} size={size} color={color} />
      </Pressable>
      {visible && (
        <View
          pointerEvents="none"
          style={[
            positionStyle,
            {
              backgroundColor: '#111827',
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              maxWidth: 320,
            },
            tooltipStyle,
          ]}
        >
          <Text style={{ color: '#fff', fontSize: 12 }}>{message}</Text>
        </View>
      )}
    </View>
  );
}
