import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

// Public assets observed in https://mcciapune.com/ and its linked stylesheets.
const directory = resolve("public/branding/mccia");
await mkdir(directory, { recursive: true });
const files = [
  [
    "logo.png",
    "https://mcciapune.com/static/assets/images/logos/logo-mccia-white-blue-new.png",
  ],
  [
    "logo-white.png",
    "https://mcciapune.com/static/assets/images/logos/logo-mccia-white.png",
  ],
  [
    "favicon.png",
    "https://mcciapune.com/static/assets/images/logos/Favicon.png",
  ],
  [
    "Poppins-OFL.txt",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/OFL.txt",
  ],
  [
    "Lato-OFL.txt",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/lato/OFL.txt",
  ],
];
const fontStylesheets = [
  "https://fonts.googleapis.com/css?family=Poppins:300,400,500,500i,600,600i,700&display=swap",
  "https://fonts.googleapis.com/css?family=Lato:300,400,700&display=swap",
];
const fontRules = [];
async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const officialPage = await fetchBytes("https://mcciapune.com/");
const officialCss = await fetchBytes(
  "https://mcciapune.com/static/assets/scss/main.css",
);
const linkedPage = officialPage.toString("utf8").replaceAll("&amp;", "&");
for (const url of fontStylesheets) {
  if (!linkedPage.includes(url)) {
    throw new Error(
      `The official homepage no longer links ${url}. Review its font links before refreshing.`,
    );
  }
}
if (!officialCss.toString("utf8").includes('"Candara"')) {
  throw new Error(
    "MCCIA's stylesheet has changed. Review the source typography before updating its metadata.",
  );
}
for (const url of fontStylesheets) {
  const css = (await fetchBytes(url)).toString("utf8");
  for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const rule = match[1],
      family = rule.match(/font-family:\s*'([^']+)'/)?.[1],
      weight = rule.match(/font-weight:\s*(\d+)/)?.[1],
      style = rule.match(/font-style:\s*(\w+)/)?.[1],
      source = rule.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (
      !family ||
      !weight ||
      !style ||
      !source ||
      !source.startsWith("https://fonts.gstatic.com/")
    )
      throw new Error(
        "Unexpected font stylesheet. Inspect it before updating assets.",
      );
    const extension = new URL(source).pathname.split(".").at(-1);
    if (!["ttf", "woff2", "woff"].includes(extension))
      throw new Error("Unsupported font format.");
    const name = `${family.toLowerCase()}-${weight}-${style}.${extension}`;
    if (files.some(([file]) => file === name))
      throw new Error(
        "This stylesheet returned subsets. Inspect before saving.",
      );
    files.push([name, source]);
    const format = extension === "ttf" ? "truetype" : extension;
    fontRules.push(
      `@font-face { font-family: '${family}'; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url('/branding/mccia/${name}') format('${format}'); }`,
    );
  }
}
const manifest = [];
for (const [file, url] of files) {
  const bytes = await fetchBytes(url);
  if (
    file.endsWith(".png") &&
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new Error(`Unexpected image response: ${file}`);
  await writeFile(resolve(directory, file), bytes);
  manifest.push({
    file,
    url,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(resolve(directory, "fonts.css"), `${fontRules.join("\n")}\n`);
await writeFile(
  resolve(directory, "sources.json"),
  JSON.stringify(
    {
      website: "https://mcciapune.com/",
      stylesheet: "https://mcciapune.com/static/assets/scss/main.css",
      retrievedAt: new Date().toISOString(),
      bodyFont: "Candara",
      navigationFont: "Segoe UI",
      applicationFonts: {
        body: "Lato",
        navigation: "Lato",
        headings: "Poppins",
      },
      websiteSha256: createHash("sha256").update(officialPage).digest("hex"),
      stylesheetSha256: createHash("sha256").update(officialCss).digest("hex"),
      note: "Candara and Segoe UI are referenced system fonts, not redistributed font files. Poppins/Lato are linked by the official homepage and downloaded from its Google Fonts URLs.",
      fontStylesheets,
      assets: manifest,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${manifest.length} official-site logo and linked font assets to public/branding/mccia.`,
);
