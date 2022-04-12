const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const simpleIcons = require("simple-icons");
const imageSize = require("image-size")
const videoSize = require("get-video-dimensions");
const path = require("path");
const htmlmin = require("html-minifier");
const mathjax = require("mathjax");
const eleventyGoogleFonts = require("eleventy-google-fonts");
const fs = require("fs");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItAttrs = require("markdown-it-attrs");
const markdownItShiki = require("markdown-it-shiki").default;

let mathjax_instance;

const mediaCacheFile = ".mediasizecache";

module.exports = function (eleventyConfig) {
    eleventyConfig.setWatchThrottleWaitTime(100);

    eleventyConfig.addPlugin(eleventyGoogleFonts);
    
    eleventyConfig.addPassthroughCopy("media");
    eleventyConfig.addPassthroughCopy({"media/icon.png": "favicon.ico"});

    const options = { html: true };
    const markdownLib = markdownIt(options)
        .use(markdownItShiki, {
            theme: {
                dark: 'min-dark',
                light: 'min-light'
            }
        })
        .use(markdownItAttrs)
        .use(markdownItAnchor);
    
    eleventyConfig.setLibrary("md", markdownLib);

    let mediaSizeCache;
    if (fs.existsSync(mediaCacheFile)) {
        mediaSizeCache = new Map(JSON.parse(fs.readFileSync(mediaCacheFile).toString()))
    } else {
        mediaSizeCache = new Map();
    }
    
    const production = process.env.CI === "true";
    eleventyConfig.addGlobalData("production", production);
    eleventyConfig.setUseGitIgnore(production);

    eleventyConfig.addNunjucksFilter("formatDateLong", value => {
        const day = days[value.getDay()];
        const dayOfMonth = value.getDate();
        let postfix;
        switch (dayOfMonth) {
            case 1:
            case 11:
            case 21:
            case 31:
                postfix = "st";
                break;
            case 2:
            case 12:
            case 22:
            case 32:
                postfix = "nd";
                break;
            case 3:
            case 13:
            case 23:
            case 33:
                postfix = "rd";
                break;
            default:
                postfix = "th";
                break;
        }
        const month = months[value.getMonth()];
        const year = value.getFullYear();
        return `${day} ${dayOfMonth}<sup>${postfix}</sup> ${month} ${year}`;
    });

    eleventyConfig.addCollection("sortedPosts", collectionApi => {
        return collectionApi.getFilteredByTag("posts").sort(function (a, b) {
            return b.date - a.date;
        });
    });

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
        const icon = simpleIcons.get(iconName);
        if (!icon) {
            throw Error(`Simple icon does not have ${iconName}`);
        }
        const svg = icon.svg;
        return "<svg class=\"icon\"".concat(svg.slice(4));
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
        return mathjax_instance.startup.adaptor.innerHTML(mathjax_instance.tex2svg(source, {display: false}));
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
        const output = mathjax_instance.startup.adaptor.innerHTML(mathjax_instance.tex2svg(latex, {display: true}));
        return `<div class="math">${output}</div>`;
    });

    eleventyConfig.addShortcode("image", function (src, alt) {
        try {
            const {height, width} = mediaSizeCache.get(src) || imageSize(path.join(__dirname, src));
            mediaSizeCache.set(src, {height, width});
            return `<div style="display: contents;"><img src="${src}" alt="${alt}" width="${width}" height="${height}"></div>`;
        } catch (err) {
            console.log(`Error finding size of image ${src}`);
            return `<div style="display: contents;"><img src="${src}" alt="${alt}"></div>`;
        }
        
    });

    eleventyConfig.addShortcode("video", async function (src) {
        try {
            const {height, width} = mediaSizeCache.get(src) || await videoSize(path.join(__dirname, src));
            mediaSizeCache.set(src, {height, width});
            return `<div style="display: contents;"><video controls loop src="${src}" width="${width}" height="${height}"></video></div>`;
        } catch (err) {
            console.log(`Error finding size of video ${src}`);
            return `<div style="display: contents;"><video controls loop src="${src}"></video></div>`;
        }
    });

    eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
        if (production && outputPath && outputPath.endsWith(".html")) {
            return htmlmin.minify(content, {
                useShortDoctype: true,
                removeComments: true,
                collapseWhitespace: true,
                minifyJS: true,
                minifyCSS: true,
            });
        }
        return content;
    });

    // Cache the results of images sizing
    eleventyConfig.on("afterBuild", () => {
        fs.writeFileSync(mediaCacheFile, JSON.stringify(Array.from(mediaSizeCache)));
    });

    return {
        dir: {
            input: "src",
            output: "dist"
        }
    }
}
