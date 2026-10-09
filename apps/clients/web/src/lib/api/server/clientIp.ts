import 'server-only';

import { headers } from 'next/headers';

export async function clientIpHeader(): Promise<Record<string, string>> {
  const incoming = await headers();
  const ip = incoming.get('x-forwarded-for') ?? incoming.get('x-real-ip');

  return ip ? { 'x-forwarded-for': ip } : {};
}
