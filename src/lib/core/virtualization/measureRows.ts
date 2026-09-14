export const isFirefoxNavigator = () =>
  typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1

export const ESTIMATE_SIZE = 50
