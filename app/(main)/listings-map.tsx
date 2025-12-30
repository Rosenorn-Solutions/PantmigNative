import { Platform } from 'react-native';

const Screen = Platform.OS === 'web'
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ? require('./listings-map.web').default
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  : require('./listings-map.native').default;

export default Screen;
