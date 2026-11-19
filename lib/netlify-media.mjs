import { getStore } from '@netlify/blobs'

export const hourMs = 60 * 60 * 1000
export const mediaName = /^\d{13}-[a-f0-9-]{36}\.gif$/

export function getMediaStore() {
  return getStore({ name: 'collectobserve', consistency: 'strong' })
}

export async function publishingEnabled(store = getMediaStore()) {
  return await store.get('settings/hourly') === 'enabled'
}
