import { StyleSheet } from 'react-native';

export const formStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
  },
  // Consistent field label style across screens
  webPickerLabel: { fontSize: 12, color: '#444', marginBottom: 6 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  // Shared city typeahead styles
  typeaheadContainer: {
    position: 'relative',
    overflow: 'visible',
    // Avoid extra gap below the dropdown overlay
    marginBottom: 0,
  },
  typeaheadOpen: { zIndex: 9999, elevation: 50 },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 50,
    maxHeight: 240,
    zIndex: 9999,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    backgroundColor: '#fff',
  },
  dropdownItemPressed: { backgroundColor: '#f5f5f5' },
  dropdownText: { fontSize: 14, color: '#222' },
  dropdownHint: { padding: 12, fontSize: 12, color: '#666' },
});
