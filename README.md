# Arts and Sports Pupil's Book — Standard Four

An accessible, interactive digital textbook published by the Tanzania Institute of Education.

## Read the book

After GitHub Pages is enabled, the book is available at:

https://waziri11.github.io/arts-and-sports-standard-four-adt/

The reader includes read-aloud audio, image descriptions, a glossary, accessible navigation, display settings, and interactive learning activities.

## Publish with GitHub Pages

1. Create a public GitHub repository and push this folder to its `main` branch.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Open the **Actions** tab and wait for **Deploy ADT book to GitHub Pages** to finish.
5. Use the Pages URL shown in the successful deployment.

Every push to `main` republishes the book automatically.

## Local preview

Serve this folder with any static web server and open `index.html` through the server. Opening the HTML file directly may prevent browser features from loading local resources.

## Accessibility and offline use

All book pages, fonts, images, interface resources, and English read-aloud audio are included in this repository. The `.nojekyll` file ensures GitHub Pages publishes the bundle unchanged.

## Sign-language videos

All 79 reading positions map to muted 720p H.264 videos. The published reader
streams the original files from the fixed repository revision in
`assets/sign-language.js`; GitHub Pages excludes the large `videos/` folder.
Local and downloaded copies use their own `videos/` folder. Published video
playback requires a network connection.

The sign-language player can run independently. Starting narration also starts
signing, and pausing narration pauses signing. The player preserves natural
1× signing speed and retries temporary media delivery failures up to three times.

After editing a manifest or embedded resource, run:

```sh
python3 scripts/refresh-offline-preloader.py
node --test tests/sign-language.test.cjs
python3 scripts/audit-sign-videos.py --decode --remote
```

The audit verifies all page mappings, embedded configuration, full local decoding,
and ranged delivery of matching remote video bytes. Open `tests/video-playback.html`
through the local server or published site to test the actual reader on every page,
including playback at the start, middle, and end of each clip.
