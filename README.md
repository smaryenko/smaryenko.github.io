# smaryenko.github.io

Personal site of Stanislav Maryenko: pet projects, data notebooks and test automation frameworks.

Live at <https://smaryenko.github.io/>.

## Structure

- `index.html`: the whole page
- `assets/css/style.css`: styles, including light/dark themes
- `assets/js/`: plain deferred scripts, loaded in order from `index.html`
  - `site.js`: shared helpers on `window.site` (theme check, toast, 404 overlay)
  - `theme.js`: light/dark toggle
  - `grid.js`: interactive test grid in the hero
  - `terminal.js`: hidden terminal
  - `utils.js`: back-to-top, card reveal, 404 handling, Konami code, name easter egg
- `assets/fonts/`: self-hosted Inter and Fraunces (latin subset)
- `images/`: project images, favicon and social preview (`og.jpg`)

No build step. Open `index.html` in a browser, or push to `main` to publish via GitHub Pages.

## Credits

Originally based on [Hyperspace by HTML5 UP](https://html5up.net/hyperspace) (CC BY 3.0), since redesigned with custom HTML, CSS and JavaScript.
