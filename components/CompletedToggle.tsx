import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface CompletedToggleProps {
  showCompleted: boolean;
  onToggle(): void;
  style?: any;
  labelShow?: string;
  labelHide?: string;
  hiddenCount?: number; // number of items currently hidden when showCompleted = false
}

/**
 * Reusable pill toggle for showing/hiding completed/closed listings.
 * Keeps styling consistent across donor and recycler views.
 */
export const CompletedToggle: React.FC<CompletedToggleProps> = ({ showCompleted, onToggle, style, labelShow = 'Vis afsluttede', labelHide = 'Skjul afsluttede', hiddenCount }) => {
  return (
    <View style={[{ position: 'absolute', top: 8, right: 8 }, style]}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          backgroundColor: showCompleted ? '#334155' : '#64748b',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center'
        })}
        accessibilityRole="button"
        accessibilityLabel={labelShow}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
          {showCompleted ? labelHide : labelShow}
          {!showCompleted && hiddenCount && hiddenCount > 0 ? ` (${hiddenCount})` : ''}
        </Text>
      </Pressable>
    </View>
  );
};

export default CompletedToggle;