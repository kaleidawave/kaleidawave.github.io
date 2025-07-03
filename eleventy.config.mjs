import * as simpleIcons from "simple-icons"
import imageSize from "image-size"
import videoSize from "get-video-dimensions"
import path from "path"
import mathjax from "mathjax"
import eleventyGoogleFonts from "eleventy-google-fonts"
import fs from "fs"
import markdownIt from "markdown-it"
import markdownItAnchor from "markdown-it-anchor"
import markdownItAttrs from "markdown-it-attrs";
import markdownItShiki from "markdown-it-shiki"
import eleventyRSS from "@11ty/eleventy-plugin-rss";
import cheerio from "cheerio"

let mathjax_instance;

const mediaCacheFile = ".mediasizecache";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function (eleventyConfig) {
    eleventyConfig.addPlugin(eleventyRSS);

    eleventyConfig.setWatchThrottleWaitTime(100);

    eleventyConfig.addPlugin(eleventyGoogleFonts);

    eleventyConfig.addPassthroughCopy("media");
    eleventyConfig.addPassthroughCopy({ "media/icon.png": "favicon.ico" });

    const options = { html: true };
    const markdownLibrary = markdownIt(options)
        .use(markdownItShiki, {
            theme: {
                dark: 'github-dark',
                light: 'github-light'
            }
        })
        .use(markdownItAttrs)
        .use(markdownItAnchor);

    eleventyConfig.setLibrary("md", markdownLibrary);

    let mediaSizeCache;
    if (fs.existsSync(mediaCacheFile)) {
        mediaSizeCache = new Map(JSON.parse(fs.readFileSync(mediaCacheFile).toString()))
    } else {
        mediaSizeCache = new Map();
    }

    const production = process.env.CI === "true";

    eleventyConfig.addGlobalData("production", production);
    eleventyConfig.setUseGitIgnore(production);

    // Check data
    eleventyConfig.addPreprocessor("check front-matter", "*", (data, content) => {
        const { filePathStem } = data.page;
        if (filePathStem !== "/posts/index" && filePathStem.startsWith("/posts")) {
            if (!data.image || !data.image.startsWith("/media")) {
                console.log(data, data.image)
                console.error(`Post ${filePathStem}, has no image or not one starting with '/media'`);
            }
        }

        if (content.includes("#TODO")) {
            console.error(`Post ${filePathStem}, has unfinished content (#TODO)`);
        }
    });

    // Include + wrap in style tag because include in style tags gets consistent broken
    // by HTML formatters
    eleventyConfig.addShortcode("includestyle", function (pathToStyle) {
        const cssPath = path.resolve("src", "_includes", pathToStyle.replace("/", path.sep));
        return `<style>${fs.readFileSync(cssPath)}</style>`
    })

    eleventyConfig.addShortcode("includewidget", function (pathToStyle) {
        const widgetPath = path.resolve("src", "_includes", "widgets", pathToStyle);
        // TODO some processing of HTML here
        const content = fs.readFileSync(widgetPath, { encoding: "utf-8" });
        // Empty lines break the markdown parser. So clear them here
        const formatted = content.split("\n").filter(line => line.trim() !== "").join("\n");
        return formatted
    })

    eleventyConfig.addNunjucksFilter("formatDateLong", value => {
        const dayOfMonth = value.getDate();
        const postfix = (() => {
            switch (dayOfMonth) {
                case 1:
                case 11:
                case 21:
                case 31:
                    return "st";
                case 2:
                case 12:
                case 22:
                case 32:
                    return "nd";
                case 3:
                case 13:
                case 23:
                    return "rd";
                default:
                    return "th";
            }
        })();

        const day = days[value.getDay()];
        const month = months[value.getMonth()];
        const year = value.getFullYear();
        return `${day} ${dayOfMonth}<sup>${postfix}</sup> ${month} ${year}`;
    });

    eleventyConfig.addCollection("sortedPosts", collectionApi =>
        collectionApi.getFilteredByTag("posts").sort((a, b) => b.date - a.date)
    );

    eleventyConfig.addNunjucksFilter(
        "formatDateShort",
        value => `${value.getDate()}/${value.getMonth() + 1}/${value.getFullYear()}`
    );

    eleventyConfig.addNunjucksFilter(
        "formatDateShortDash",
        value => {
            const year = value.getFullYear();
            const month = (value.getMonth() + 1).toString().padStart(2, "0");
            const day = value.getDate().toString().padStart(2, "0");
            return `${year}-${month}-${day}`;
        }
    );

    eleventyConfig.addShortcode("icon", function (iconName) {
        const icon = Reflect.get(simpleIcons, `si${iconName}`);
        if (!icon) {
            throw Error(`Simple icon does not have ${iconName}`);
        }
        return `<svg class=\"icon\" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="${icon.path}"></svg>`;
    });

    eleventyConfig.addShortcode("mathinline", async function (source) {
        if (!mathjax_instance) {
            mathjax_instance = await mathjax.init({
                loader: {
                    load: ['input/tex', 'output/svg'],
                },
                fontCache: 'local'
            });
        }
        return mathjax_instance.startup.adaptor.innerHTML(mathjax_instance.tex2svg(source, { display: false }));
    });

    // Latex, Images and videos are wrapped in `div` to avoid markdown plugin wanting to wrap them in `p` tags
    eleventyConfig.addPairedShortcode("math", async function (latex) {
        if (!mathjax_instance) {
            mathjax_instance = await mathjax.init({
                loader: {
                    load: ['input/tex', 'output/svg'],
                },
                fontCache: 'local'
            });
        }
        const output = mathjax_instance.startup.adaptor.innerHTML(mathjax_instance.tex2svg(latex, { display: true }));
        return `<div class="math">${output}</div>`;
    });

    eleventyConfig.addPairedShortcode("parralel", function (content) {
        const inner = markdownLibrary.render(content);
        const [left, right] = inner.split("<hr>");
        return `<div class="parralel">
            <div>${left}</div>
            <div>${right}</div>
        </div>`
    });

    eleventyConfig.addPairedShortcode("center", function (content) {
        const inner = markdownLibrary.render(content);
        return `<h3 class="center">${inner}</h3>`
    });

    eleventyConfig.addPairedShortcode("caption", function (content) {
        const inner = markdownLibrary.render(content);
        return `<h6 class="caption">${inner}</h6>`
    });

    eleventyConfig.addPairedShortcode("footnote", function (content, id) {
        const inner = markdownLibrary.render(content);
        return `<h6 id="foot${id}">(${id})>${inner}</h6>`
    });

    eleventyConfig.addTransform("image & video size and elements", async function (content) {
        // This does a few things
        // 1. images that are links get extracted from the single paragraph wrapper and have the `media-container` class added to them 
        // 2. (not production as handled already) adds width and height attributes to images based on their dimensions in the filesystem
        // 3. adds width and height attributes to VIDEOS based on their dimensions in the filesystem
        // 4 & 5. extracts images and videos from the single paragraph wrapper element (I dislike why the markdown parser outputs this :( and copies attributes)

        // TODO:
        // - Lift <style> blocks to top
        // - Lift <script> tags to end
        if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
            const $ = cheerio.load(content, { decodeEntities: false });

            $('p > a > img').each((_index, element) => {
                const img = $(element);
                const anchor = img.parent();
                const paragraph = anchor.parent();
                anchor.addClass("media-container");
                paragraph.replaceWith(anchor);
            });

            // Production handled by jampack
            if (!production) {
                $('img').each((_index, element) => {
                    const img = $(element);
                    let { src } = element.attribs;
                    if (src == "/media/icon.png") {
                        return;
                    }
                    const location = path.resolve(this.page.inputPath, "..", "..", src.replace("/", path.sep).slice(1));
                    try {
                        const { height, width } = mediaSizeCache.get(src) ?? imageSize(location);
                        mediaSizeCache.set(src, { height, width })
                        img.attr("height", height);
                        img.attr("width", width);
                    } catch (error) {
                        console.error("Could not resolve image (thus no image dimension calculations)", this.page.inputPath, src, location)
                    }
                });
            }

            $('video').each(async (_index, element) => {
                const video = $(element);
                let { src } = element.attribs;
                const location = path.resolve(this.page.inputPath, "..", "..", src.replace("/", path.sep).slice(1));
                try {
                    const { height, width } = mediaSizeCache.get(src) ?? await videoSize(location);
                    mediaSizeCache.set(src, { height, width })
                    video.attr("height", height);
                    video.attr("width", width);
                } catch (error) {
                    console.error("video", this.page.inputPath, src, location)
                }
            });

            $('p > img:only-child').each((_index, element) => {
                const img = $(element);
                const parent = img.parent();
                Object.entries(parent.attribs || {}).forEach(([attr, value]) => { video.attr(attr, value); });
                parent.replaceWith(img);
            });

            $('p > video:only-child').each((_index, element) => {
                const video = $(element);
                const parent = video.parent();
                Object.entries(parent[0].attribs || {}).forEach(([attr, value]) => { video.attr(attr, value); });
                parent.replaceWith(video);
            });

            // Convert the modified DOM back to HTML
            return $.html();
        }

        return content;
    });

    return {
        dir: {
            input: "src",
            output: "dist"
        }
    }
}
