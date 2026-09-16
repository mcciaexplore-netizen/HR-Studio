# MCCIA brand assets

Downloaded from the [official MCCIA website](https://mcciapune.com/) for this project's requested branding. Original logos are stored unchanged; their names, URLs, sizes and SHA-256 hashes are recorded in `sources.json`.

The [official stylesheet](https://mcciapune.com/static/assets/scss/main.css) specifies **Candara** for body text and **Segoe UI** for navigation. These are system fonts: the website does not provide downloadable copies, and no proprietary system fonts are redistributed here.

The homepage also links **Lato** and **Poppins** through Google Fonts. Those font files are stored locally. HR Studio uses **Lato for body text, forms, tables and navigation**, and **Poppins for headings** so typography is consistent across devices. This is an app-specific use of MCCIA's linked fonts, rather than an exact copy of the website's system-font hierarchy. Regular Lato and semibold Poppins are preloaded. Their SIL Open Font License notices are included in `Lato-OFL.txt` and `Poppins-OFL.txt`. Fonts and logos are served by the app without contacting external servers at runtime.

Refresh the observed public assets with `npm run branding:fetch`. Logo ownership remains with MCCIA; the font licenses apply only to the fonts.
