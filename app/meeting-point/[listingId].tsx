import { Platform } from 'react-native';

let Screen: any;
if (Platform.OS === 'web') {
	// Require at runtime to avoid native evaluating web code
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	Screen = require('./[listingId].web').default;
} else {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	Screen = require('./[listingId].native').default;
}

export default Screen;
export {};

