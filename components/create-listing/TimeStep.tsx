import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import PressableButton from '../PressableButton';

type Styles = {
  input: any;
  inputError: any;
  errorText: any;
  dateInput: any;
  placeholder: any;
  webModalBackdrop: any;
  webModalCard: any;
  webPickerLabel: any;
  navRow: any;
  button: any;
};

type Props = Readonly<{
  errors: Readonly<{ availableFrom?: string; availableTo?: string }>;
  formAvailableFrom?: Date;
  formAvailableTo?: Date;
  datePart: (d: Date) => string;
  onDatePick: (field: 'availableFrom' | 'availableTo') => (event: DateTimePickerEvent, date?: Date) => void;
  renderFromPickers: () => React.ReactNode; // date picker
  renderToPickers: () => React.ReactNode;   // date picker
  fromDateStr: string;
  toDateStr: string;
  setFromDateStr: (s: string) => void;
  setToDateStr: (s: string) => void;
  parseLocal: (d: string, t: string) => Date | null; // kept for compatibility; date-only parsing done locally
  setErrorAvailableFrom: (msg: string) => void;
  setErrorAvailableTo: (msg: string) => void;
  setAvailableFrom: (d: Date) => void;
  setAvailableTo: (d: Date) => void;
  onOpenFrom: () => void; // open date picker for availableFrom
  onOpenTo: () => void;   // open date picker for availableTo
  shiftEndIfNeeded: (d: Date) => void;
  onBack: () => void;
  onNext: () => void;
  styles: Styles;
}>;

export default function TimeStep(props: Props) {
  const { errors, formAvailableFrom, formAvailableTo, datePart, renderFromPickers, renderToPickers, setFromDateStr, setToDateStr, /* parseLocal unused */ setErrorAvailableFrom, setErrorAvailableTo, setAvailableFrom, setAvailableTo, onOpenFrom, onOpenTo, shiftEndIfNeeded, onBack, onNext, styles } = props;

  // Web-only CSS for HTML date/time inputs
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const id = 'pmg-web-date-input-css';
      if (typeof document !== 'undefined' && !document.getElementById(id)) {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
          .pmg-date-input { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 8px; width: 100%; box-sizing: border-box; font-size: 14px; color: #111827; }
          .pmg-date-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
          .pmg-date-input-error { border-color: #dc2626 !important; }
        `;
        document.head.appendChild(style);
      }
    } catch {}
  }, []);

  const webContent = (
    <>
          <View style={{ position: 'relative' }}>
            <Text style={styles.webPickerLabel}>Tilgængelig fra (krævet)</Text>
            {(() => {
              const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
              const value = formAvailableFrom ? fmt(formAvailableFrom) : '';
              return (
                <input
                  type="date"
                  className={errors.availableFrom ? 'pmg-date-input pmg-date-input-error' : 'pmg-date-input'}
                  value={value}
                  title="Tilgængelig fra"
                  aria-label="Tilgængelig fra"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.value; // YYYY-MM-DD
                    if (!v) { setAvailableFrom?.(undefined as unknown as Date); return; }
                    const [y, m, d] = v.split('-').map(Number);
                    const nd = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
                    if (!Number.isNaN(nd.getTime())) {
                      setAvailableFrom(nd);
                      setFromDateStr(ddmmyyyy(nd));
                      setErrorAvailableFrom('');
                      shiftEndIfNeeded(nd);
                    }
                  }}
                />
              );
            })()}
            {!!errors.availableFrom && <Text style={styles.errorText}>{errors.availableFrom}</Text>}
          </View>
          <View style={{ position: 'relative', marginTop: 4 }}>
            <Text style={styles.webPickerLabel}>Tilgængelig til (krævet)</Text>
            {(() => {
              const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
              const value = formAvailableTo ? fmt(formAvailableTo) : '';
              const min = formAvailableFrom ? fmt(formAvailableFrom) : undefined;
              return (
                <input
                  type="date"
                  className={errors.availableTo ? 'pmg-date-input pmg-date-input-error' : 'pmg-date-input'}
                  value={value}
                  min={min}
                  title="Tilgængelig til"
                  aria-label="Tilgængelig til"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.value; // YYYY-MM-DD
                    if (!v) { setAvailableTo?.(undefined as unknown as Date); return; }
                    const [y, m, d] = v.split('-').map(Number);
                    const nd = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
                    if (!Number.isNaN(nd.getTime())) {
                      if (formAvailableFrom && nd < formAvailableFrom) { setErrorAvailableTo('Slutdato skal være samme dag eller efter startdato'); return; }
                      setAvailableTo(nd);
                      setToDateStr(ddmmyyyy(nd));
                      setErrorAvailableTo('');
                    }
                  }}
                />
              );
            })()}
            {!!errors.availableTo && <Text style={styles.errorText}>{errors.availableTo}</Text>}
          </View>

          {/* No pickup times: only date range */}
    </>
  );

  const nativeContent = (
    <>
      <View>
    <Pressable style={[styles.input, styles.dateInput, errors.availableFrom && styles.inputError]} onPress={onOpenFrom}>
  <Text style={formAvailableFrom ? undefined : styles.placeholder}>{formAvailableFrom ? `${datePart(formAvailableFrom)}` : 'Tilgængelig fra (krævet)'}</Text>
    </Pressable>
            {!!errors.availableFrom && <Text style={styles.errorText}>{errors.availableFrom}</Text>}
            {renderFromPickers()}
          </View>
          <View>
    <Pressable style={[styles.input, styles.dateInput, errors.availableTo && styles.inputError]} onPress={onOpenTo}>
  <Text style={formAvailableTo ? undefined : styles.placeholder}>{formAvailableTo ? `${datePart(formAvailableTo)}` : 'Tilgængelig til (krævet)'}</Text>
    </Pressable>
            {!!errors.availableTo && <Text style={styles.errorText}>{errors.availableTo}</Text>}
            {renderToPickers()}
          </View>

          {/* No pickup times on native either */}
    </>
  );

  return (
    <>
      {Platform.OS === 'web' ? webContent : nativeContent}
      <View style={styles.navRow}>
        <PressableButton title="Tilbage" onPress={onBack} color="#6b7280" iconName="arrow-left" style={styles.button} />
        <PressableButton title="Næste" onPress={onNext} color="#2563eb" iconName="arrow-right" iconPosition="right" style={styles.button} />
      </View>
    </>
  );
}
