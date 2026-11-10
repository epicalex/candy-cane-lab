# Candy Cane Lab
Static, dependency-free candy cane generator. Serve this directory with a local HTTP server, or publish its contents to GitHub Pages.
The designer fits the browser window, with independently scrolling recipe controls. Tilt is shared when switching between 2D and 3D.
2D: colour palettes, optional accent stripes, adjustable thickness/hook/repeats/stripe width, SVG copy and download.
3D: rounded tube mesh with helical stripes, drag rotation, rotation slider, start/pause spin and speed, transparent PNG of current angle.
The 3D preview is rendered with WebGL 2, smooth surface normals and antialiased procedural stripes, not an exported 3D model or video. Spin starts only on request.

## Creator

[Alex Cragg on LinkedIn](https://www.linkedin.com/in/alexcragg) · [GitHub repository](https://github.com/epicalex/candy-cane-lab)

## Site icons and sharing

`assets/favicon.svg` is the editable browser icon, with ICO and PNG fallbacks and an Apple touch icon. `assets/social-card.svg` is the editable source for the 1200 × 630 PNG sharing card. Open Graph and Twitter card metadata in `index.html` use the GitHub Pages URL; update those absolute URLs if the site moves.
