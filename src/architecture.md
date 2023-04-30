---
layout: main_layout.njk
title: How this site is built
---

This site is a static site generated with [11ty](https://github.com/11ty/eleventy/). The posts are written in Markdown. After the build, it is *post-optimized* with [Jampack](https://github.com/divriots/jampack) (compresses and checks the HTML 11ty generates). I wrote the styling/CSS myself, rather than using a theme. I make the banners with Figma, either using my own photographs or [DALL.E generations](https://labs.openai.com/).

It is hosted on GitHub Pages. I edit the markdown files by switching between VS Code, Helix, and Obsidian. Once ready, I push them to a GitHub repository, where a push hook builds and deploys the site using [crazy-max/ghaction-github-pages](https://github.com/crazy-max/ghaction-github-pages).

I collect analytics using [Cloudflare web analytics](https://www.cloudflare.com/en-gb/web-analytics/). I only really want to know whether 10 or 10,000 people read a post, but it gives other information like the times visited, locations and referrers. Unfortunately, you can only view three months and can't export data to any format other than a PDF screenshot 😑 (pls add CSV 🙏). But I do get backups via automated weekly emails.
