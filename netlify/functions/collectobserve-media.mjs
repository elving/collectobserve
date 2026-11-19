import { getMediaStore, mediaName } from '../../lib/netlify-media.mjs'

export const config = { path: '/media/:filename', method: ['GET', 'HEAD'] }

export default async function media(request, context) {
  const filename = context.params.filename
  if (!mediaName.test(filename)) return new Response(null, { status: 404 })
  const gif = await getMediaStore().get(`media/${filename}`, { type: 'arrayBuffer' })
  if (gif === null) return new Response(null, { status: 404 })
  return new Response(request.method === 'HEAD' ? null : gif, { headers: {
    'Content-Type': 'image/gif',
    'Content-Length': gif.byteLength,
    'Cache-Control': 'public, max-age=3600, immutable',
  } })
}
