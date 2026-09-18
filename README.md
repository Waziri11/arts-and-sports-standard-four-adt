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

The workflow runs media regressions, checks embedded resources and toolbar
installation, then validates and stages the reader with `scripts/prepare-pages.py`.
Only runtime files are published; maintenance scripts, tests, reports and source
metadata stay in the repository. No ZIP or SCORM distribution is generated.

Before pushing, run the checks below and `python3 scripts/verify-reader-toolbar.py`.
After deployment succeeds, check both covers, mobile drawers, narration and
remote video delivery at the Pages URL. If a release breaks those flows, revert
its commit and push the revert to `main` to redeploy the previous working version.

The September 2026 cleanup removed 959 unused files (47.5 MB), including unmapped
audio, obsolete images and the superseded runtime. Original source PDFs, source
videos, evaluation documentation and all mapped narration are preserved.

## Local preview

Serve this folder with any static web server and open `index.html` through the server. Opening the HTML file directly may prevent browser features from loading local resources.

## Accessibility and offline use

All book pages, fonts, images, interface resources, and English read-aloud audio are included in this repository. The `.nojekyll` file ensures GitHub Pages publishes the bundle unchanged.

The responsive toolbar uses the same runtime, reader stylesheet and mobile drawer
helpers as **Writing Pupil's Book Standard 1**. Below 768px, Contents and
accessibility tools open in bottom drawers with scrolling and drag/keyboard
dismissal. Desktop retains the full toolbar and popovers. The original content
stylesheet is retained for this book's page layouts.

Run `python3 scripts/verify-reader-toolbar.py` to audit the installation, and open
`tests/toolbar-responsive.html` through the local server to check the actual
reader at phone, landscape, tablet and desktop sizes.

## Sign-language videos

All 81 reading positions map to muted H.264 videos named `page_1.mp4` through
`page_81.mp4` in `videos/`. The front cover is page 1, the approval certificate
is page 2, and the back cover is page 81. Existing content videos have moved
forward by one position without changing their content.

The published reader streams the interior videos from the fixed repository
revision in `assets/sign-language.js`, using an explicit map to their original
filenames. GitHub Pages includes the two small cover videos and excludes the
large interior files. Local and downloaded copies use their own `videos/`
folder. Published interior video playback requires a network connection.

Both covers use artwork from `ARTS NOT  FOR SALE.pdf` and Imani narration
(`en-TZ-ImaniNeural`, rate `-5%`). Page-specific narration filenames follow the
reader position (`page_2_n0008.mp3`, for example), while stable text IDs preserve
the connections to the original content. Shared narration, such as letters and
numbers, remains reusable across pages. Normal and Easy Read cover narration
are registered with word timings. Printed textbook page numbers remain unchanged.

The sign-language player can run independently. Starting narration also starts
signing, and pausing narration pauses signing. The player preserves natural
1× signing speed and retries temporary media delivery failures up to three times.

After editing a manifest or embedded resource, run:

```sh
python3 scripts/refresh-offline-preloader.py
node --test tests/sign-language.test.cjs
python3 scripts/verify-cover-media.py --base-url http://127.0.0.1:5500 --ffmpeg ffmpeg
python3 scripts/audit-sign-videos.py --decode --remote
```

The audit verifies all page mappings, embedded configuration, full local decoding,
and ranged delivery of matching remote video bytes after publication. The cover
audit also verifies original media checksums, all narration attachments, new audio
decoding, and the existing resource manifest. Open `tests/video-playback.html`
through the local server to test the actual reader on every page,
including playback at the start, middle, and end of each clip.
