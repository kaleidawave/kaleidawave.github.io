const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const simpleIcons = require("simple-icons");
const imageSize = require("image-size")
const videoSize = require("get-video-dimensions");
const path = require("path");
const htmlmin = require("html-minifier");
const mathjax = require("mathjax");
const eleventyGoogleFonts = require("eleventy-google-fonts");

let mathjax_instance;

module.exports = function (eleventyConfig) {

    eleventyConfig.addPlugin(syntaxHighlight);
    eleventyConfig.addPlugin(eleventyGoogleFonts);
    eleventyConfig.setUseGitIgnore(false);
    
    eleventyConfig.addPassthroughCopy("media");
    eleventyConfig.addPassthroughCopy({"media/icon.png": "favicon.ico"});
    
    // Available in 11ty 1.0
    // const production = process.env.CI === "true";
    // eleventyConfig.addGlobalData("production", production);
    // eleventyConfig.setUseGitIgnore(!production);

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
        const output = mathjax_instance.startup.adaptor.innerHTML(mathjax_instance.tex2svg(source, {display: false}))
        return output;
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
        const height = latex.length * 2;
        const output = mathjax_instance.startup.adaptor.innerHTML(mathjax_instance.tex2svg(latex, {display: true}));
        return `<div class="math"><svg style="height:${height}px"><svg${output.slice(4)}</svg></div>`;
    });

    eleventyConfig.addShortcode("image", function (src, alt) {
        const {height, width} = imageSize(path.join(__dirname, src));
        return `<div style="display: contents;"><img src="${src}" alt="${alt}" width="${width}" height="${height}"></div>`;
    });

    eleventyConfig.addShortcode("video", async function (src) {
        try {
            const {height, width} = await videoSize(path.join(__dirname, src));
            return `<div style="display: contents;"><video controls loop src="${src}" width="${width}" height="${height}"></video></div>`;
        } catch (err) {
            console.log(`Error finding size of video ${src}`);
            return `<div style="display: contents;"><video controls loop src="${src}"></video></div>`;
        }
    });

    eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
        if (outputPath && outputPath.endsWith(".html")) {
            return htmlmin.minify(content, {
                useShortDoctype: true,
                removeComments: false,
                collapseWhitespace: true,
                minifyJS: true,
                minifyCSS: true,
            });
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
