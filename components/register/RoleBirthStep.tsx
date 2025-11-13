import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { memo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import type { Gender } from '../../app/apis/pantmig-auth/models/Gender';
import PressableButton from '../PressableButton';

type Styles = {
  input: any;
  inputError: any;
  errorText: any;
  dateInput: any;
  placeholder: any;
  segmented: any;
  segmentedLabel: any;
  segmentedRow: any;
  navRow: any;
  button: any;
};

type Props = Readonly<{
  userTypeLabel: string;
  gender: Gender;
  onSelectRoleDonor: () => void;
  onSelectRoleRecycler: () => void;
  onSelectGender: (g: Gender) => void;
  birthDate: Date | null;
  setShowBirthPicker: (v: boolean) => void;
  showBirthPicker: boolean;
  onBirthChange: (e: DateTimePickerEvent, d?: Date) => void;
  errors: { gender?: string; birthDate?: string };
  reduceMotionEnabled?: boolean;
  webDateInput?: React.ReactNode;
  styles: Styles;
  onBack: () => void;
  onSubmit: () => void;
}>;

const GenderButtons = memo(({ gender, onSelectGender, styles }: { gender: Gender; onSelectGender: (g: Gender) => void; styles: any }) => (
  <View style={styles.segmentedRow}>
    <PressableButton title={`${gender===0?'✓ ':''}Ønsker ikke at oplyse`} onPress={() => onSelectGender(0)} color={gender===0 ? '#2563eb' : '#4b4d50ff'} iconName="ban" />
    <PressableButton title={`${gender===1?'✓ ':''}Mand`} onPress={() => onSelectGender(1)} color={gender===1 ? '#2563eb' : '#4b4d50ff'} iconName="person" />
    <PressableButton title={`${gender===2?'✓ ':''}Kvinde`} onPress={() => onSelectGender(2)} color={gender===2 ? '#2563eb' : '#4b4d50ff'} iconName="person-dress" />
  </View>
));
GenderButtons.displayName = 'GenderButtons';

const DateSection = memo(({ birthDate, setShowBirthPicker, showBirthPicker, onBirthChange, webDateInput, errors, styles }: any) => (
  <>
    {Platform.OS === 'web' ? (
      <View>
        {webDateInput}
        {!!errors.birthDate && <Text style={styles.errorText}>{errors.birthDate}</Text>}
      </View>
    ) : (
      <>
        <Pressable onPress={() => setShowBirthPicker(true)} style={[styles.input, styles.dateInput, errors.birthDate && styles.inputError]}>
          <Text style={!birthDate ? styles.placeholder : undefined}>{birthDate ? `${birthDate.getDate().toString().padStart(2,'0')}-${(birthDate.getMonth()+1).toString().padStart(2,'0')}-${birthDate.getFullYear()}` : 'Vælg fødselsdato'}</Text>
        </Pressable>
        {!!errors.birthDate && <Text style={styles.errorText}>{errors.birthDate}</Text>}
        {showBirthPicker && (
          <DateTimePicker
            value={birthDate || new Date(new Date().getFullYear()-13, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date(new Date().getFullYear()-13, new Date().getMonth(), new Date().getDate())}
            onChange={onBirthChange}
          />
        )}
      </>
    )}
  </>
));
DateSection.displayName = 'DateSection';

export default function RoleBirthStep({ userTypeLabel, gender, onSelectRoleDonor, onSelectRoleRecycler, onSelectGender, birthDate, setShowBirthPicker, showBirthPicker, onBirthChange, errors, webDateInput, styles, onBack, onSubmit }: Props) {
  return (
    <>
      <View style={styles.segmented}>
        <Text style={styles.segmentedLabel}>Vælg rolle</Text>
        <View style={styles.segmentedRow}>
          <PressableButton title={userTypeLabel === 'Donor' ? 'Donor ✓' : 'Donor'} onPress={onSelectRoleDonor} color={userTypeLabel === 'Donor' ? '#2563eb' : '#4b4d50ff'} iconName="gift" />
          <PressableButton title={userTypeLabel === 'Panter' ? 'Panter ✓' : 'Panter'} onPress={onSelectRoleRecycler} color={userTypeLabel === 'Panter' ? '#2563eb' : '#4b4d50ff'} iconName="recycle" />
        </View>
        <Text style={[styles.segmentedLabel, { marginTop: 16 }]}>Køn</Text>
        <GenderButtons gender={gender} onSelectGender={onSelectGender} styles={styles} />
        {!!errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
        <Text style={[styles.segmentedLabel, { marginTop: 16 }]}>Fødselsdato</Text>
        <DateSection birthDate={birthDate} setShowBirthPicker={setShowBirthPicker} showBirthPicker={showBirthPicker} onBirthChange={onBirthChange} webDateInput={webDateInput} errors={errors} styles={styles} />
      </View>
      <View style={styles.navRow}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={styles.button} />
        <PressableButton title="Opret konto" onPress={onSubmit} color="#16a34a" iconName="user-plus" style={styles.button} />
      </View>
    </>
  );
}
