# iPhone Offline Build

This folder is a separate iPhone-oriented build of the HOSA Biotechnology simulation platform.

It does **not** change the current main platform folder.

## Important honesty first

This is the simplest realistic iPhone path, but it is **not** magic:

- You still need to host it **once** over `https://`.
- You still need to open it once in **Safari** while online.
- You still need to add it to the Home Screen from Safari.
- After that, it should work offline if the cache finishes installing correctly.

What is **not** recommended:

- AirDropping the folder to your iPhone and opening `index.html` directly from `Files`
- Expecting raw `file://` local iPhone loading to behave like a real app

## What is in this folder

- `index.html`
- `styles.css`
- `app.js`
- `question_loader.js`
- `question_bank_compiled.js`
- `platform_config.json`
- `manifest.webmanifest`
- `service-worker.js`
- `icons/`
- `START_HERE.txt`

This version adds:

- a web app manifest
- an offline service worker
- iPhone home-screen metadata
- safer `localStorage` handling

## The easiest deployment path

Use GitHub Pages.

## Exact GitHub Pages steps

### Option A: easiest if you already use GitHub

1. Create a new GitHub repository.
   Suggested name: `hosa-biotech-iphone`

2. Open this folder on your computer:
   [phase5_iphone_offline_pwa](/abs/path/C:/Users/neilk/Downloads/hosabtprep/phase5_iphone_offline_pwa)

3. Upload the **contents of this folder**, not the parent folder itself.

The repository root should contain:

- `index.html`
- `styles.css`
- `app.js`
- `question_loader.js`
- `question_bank_compiled.js`
- `platform_config.json`
- `manifest.webmanifest`
- `service-worker.js`
- `icons/`

4. In GitHub, open the repository.

5. Click `Settings`.

6. In the left sidebar, click `Pages`.

7. Under `Build and deployment`, set:

- `Source`: `Deploy from a branch`
- `Branch`: `main` or whatever branch you uploaded to
- `Folder`: `/ (root)`

8. Save.

9. Wait for GitHub Pages to publish the site.

10. GitHub will give you a URL similar to:

- `https://yourusername.github.io/hosa-biotech-iphone/`

11. Open that URL on your computer once first just to confirm it loads.

## Exact iPhone steps

1. On your iPhone, open **Safari**.

Do not use Chrome for the install step.

2. Go to the GitHub Pages URL.

3. Wait for the page to finish loading completely.

Because `question_bank_compiled.js` is large, give it extra time on first load.

4. Tap around a little:

- open the setup page
- start a test
- answer a question or two
- return if you want

This helps make sure the important app files are really fetched.

5. While still in Safari, tap the `Share` button.

6. Scroll and tap `Add to Home Screen`.

7. Keep the default name or shorten it.

8. Tap `Add`.

9. Go to your Home Screen and open the new icon.

10. While still online, let it fully open once from the Home Screen icon.

11. Close it.

12. Open it again from the Home Screen icon.

That second open helps confirm the service worker had a chance to activate.

## How to test offline

1. Turn on `Airplane Mode`.

2. Turn off Wi-Fi too, if needed, so you are truly offline.

3. Open the app from the Home Screen icon.

4. Confirm that you can:

- load the app
- start a test
- move between questions
- submit a test
- reopen the app

If all of that works, you are good for on-the-road use.

## What to do if it does not work offline

Try this in order:

1. Turn internet back on.

2. Open the app from the Home Screen again.

3. Leave it open for a bit longer.

4. Close it fully.

5. Reopen it once more while online.

6. Test Airplane Mode again.

If it still fails:

- remove the Home Screen icon
- open the hosted site in Safari again
- re-add it to Home Screen
- test again

## Limitations you should know

- First install still requires internet.
- GitHub Pages publish can take a few minutes.
- The question bank is large, so first load may not feel instant.
- If Safari clears cached website data aggressively, you may need to reopen online again later.
- This is still a web app, not a native App Store app.

## If you update the platform later

1. Replace the hosted files with the new version.

2. Open the app online on your iPhone.

3. Let it load fully.

4. Close it and reopen it.

That should refresh the cached version.

## Source note

This folder was derived from:

- [phase5_hosa_biotech_testing_platform](/abs/path/C:/Users/neilk/Downloads/hosabtprep/phase5_hosa_biotech_testing_platform)

The original folder was left unchanged.
