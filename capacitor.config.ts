import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cookiezookie.gestao',
  appName: 'Cookie Zookie',
  webDir: 'dist',
  server: { url: 'https://systemzayu-hub.github.io/cookie-zookie-bd/', cleartext: false },
}
export default config
