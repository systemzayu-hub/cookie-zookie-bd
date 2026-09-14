import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cookiezookie.gestao',
  appName: 'Cookie Zookie',
  webDir: 'dist',
  // O app móvel carrega a mesma versão publicada do site e recebe suas atualizações.
  server: { url: 'https://systemzayu-hub.github.io/cookie-zookie-bd/?source=mobile-app', cleartext: false },
}
export default config
