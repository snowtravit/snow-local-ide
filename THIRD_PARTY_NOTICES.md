# ⚖️ License scope and third-party notices

The root `LICENSE` applies to original SNOW IDE code and documentation. It does not replace licenses for dependencies, tools, runtimes, or media created by other rights holders.

## npm dependencies and Docker runtimes

The frontend uses React, Monaco Editor, Lucide icons, Axios, Vite, and Tailwind CSS. The backend uses Express, Dockerode, and other packages recorded in its lockfile. These packages retain their own license and copyright notices. Consult the `LICENSE`, `NOTICE`, and package metadata supplied with the installed versions when redistributing them.

Language images contain Python and Python libraries, Node.js, OpenJDK/Eclipse Temurin, GCC, .NET, Go, PHP, or Alpine packages. Each image's contents have their own licenses. Docker images are built separately; the project MIT license does not relicense those runtimes.

## Pre-existing media excluded from the MIT license

The repository already contained the following assets without source or permission records:

- `SNOW CODING CORP/frontend/public/logo/avatar.jpg`
- `SNOW CODING CORP/frontend/public/assets/logo/avatar.jpg`
- `SNOW CODING CORP/assets/background/bg.jpg`
- `SNOW CODING CORP/assets/background/video.mp4`
- `SNOW CODING CORP/frontend/public/assets/background/video.mp4`

These assets are excluded from the root MIT license. Reusing them separately requires checking the applicable rights; the project's code license does not grant rights to third-party photographs or videos.

`docs/images/snow-ide-docker.png` is a screenshot of the real application. The documentation presentation is covered by the project license; any underlying photographs or video frames visible in the screenshot retain their separate rights.

## Existing SVG icon

`SNOW CODING CORP/frontend/public/vite.svg` contains a simple pair of code chevrons, despite its filename. Its geometry resembles the Lucide `Code` icon. Lucide icons use the ISC License; preserve the notice below for that icon and Lucide-derived assets.

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

See the installed `lucide-react` package for its complete license notice, including the notice for portions originating in Feather.
