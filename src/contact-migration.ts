const IV = 'T5auFncER9nK7SOf'
const PAYLOAD = 'Ev0SHiC/vKWi0gKR6g95K3azOzXMb6gopZnUziF+K6U8GCDZ00PJv4ea5FXXq//Q6ANt3QL0r1lkbV3DuiEU8xNheXSlyM6ZY2/YpSUI9elQYB3faSAuE1MdaVOTtJOE3iOLq6ZceK5v0AhSzlQx5IwUZWKlj90Ch70PMMyOs8xocJr9aw=='

const decode = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0))

export async function decryptPendingContacts(password: string): Promise<Record<string, string>> {
  const keyBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cookie-zookie-contact-import:${password}`))
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(IV) }, key, decode(PAYLOAD))
  return JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>
}
