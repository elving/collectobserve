# collectobserve

[collect to observe. observe to collect.](https://twitter.com/collectobserve)

The bot combines five webcam snapshots into a five-second GIF and generates a caption.

## Run locally

Install Node.js 22.9 or newer and [FFmpeg](https://ffmpeg.org/download.html), then run:

```sh
npm ci
npm run preview
```

Preview prints the generated caption and saves a GIF under `tmp/capture-*/cam.gif`. It works without X credentials. By default the bot uses the bundled OpenTopia snapshot catalog. OpenTopia refreshes its saved snapshots periodically, so consecutive frames may look the same. Set `CAM_FEED` to an HTTP(S) snapshot URL for a camera you want to capture directly, or set `CAM_CATALOG` to a JSON file with an `all` array of camera objects containing `feed` URLs.

## Publish to X

### Netlify

Netlify starts a capture at minute `13` of each hour, stores the GIF in Netlify Blobs, and serves it to Buffer from the app's public HTTPS URL. Set `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID`, and a random `COLLECTOBSERVE_JOB_KEY` as production secrets in the project settings. On Netlify Free, use the default scopes for secrets. To preview a capture, POST `{"preview":true}` to `/.netlify/functions/capture-background` with the job key in the `X-CollectObserve-Job-Key` header. The function log includes the preview GIF URL.

Run `npx netlify-cli blobs:set collectobserve settings/hourly enabled` in the linked project to enable hourly posting. Change the value to `disabled` to pause it. These changes take effect without a redeploy.

When deploying from macOS, prepare the Linux x64 function bundle before running the Netlify CLI:

```sh
npm ci --ignore-scripts
npm_config_platform=linux npm_config_arch=x64 node node_modules/ffmpeg-static/install.js
npx netlify-cli deploy --prod
```

Disable the GitHub Actions workflow when switching to the Netlify schedule.

### GitHub Actions

The GitHub Actions workflow picks a random camera from the bundled OpenTopia snapshot catalog and publishes a five-second GIF with a generated caption through Buffer. It uses five distinct snapshots from the camera's public animation view. The workflow needs the `BUFFER_API_KEY` repository secret, the `BUFFER_CHANNEL_ID` repository variable, and a public `collectobserve-media` release. A manual workflow run can preview the GIF or publish one post. Set the `PUBLISH_HOURLY` repository variable to `true` to enable scheduled posts. GitHub gets several chances to start the workflow each hour. Scheduled runs skip capture once a publishing run has uploaded a GIF in the current UTC hour.

### Direct X API

Set `CONSUMER_KEY`, `CONSUMER_SECRET`, `TOKEN`, and `TOKEN_SECRET` in `.env` or the process environment. Use OAuth 1.0a credentials for an X app with read and write access and access to the v2 media and post endpoints.

`npm start` attempts a broadcast immediately and waits ten minutes between attempts. After publishing, it also tries to update the profile location through the legacy X endpoint if the account can access it.

## Refresh a camera catalog

The scraper commands write to `tmp/cams-livefeed.json` and `tmp/cams-livestill.json`. Pass a page count after `--` to collect a smaller sample. Without a page count, both commands request up to 150 pages.

```sh
npm run scrapeLiveFeedCams -- 1
npm run scrapeLiveStillCams -- 1
CAM_CATALOG=tmp/cams-livestill.json npm run preview
```
