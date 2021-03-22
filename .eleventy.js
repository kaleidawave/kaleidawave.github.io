const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const simpleIcons = require("simple-icons");
const imageSize = require("image-size")
const videoSize = require("get-video-dimensions");
const path = require("path");

module.exports = function (eleventyConfig) {
    eleventyConfig.addPlugin(syntaxHighlight);
    eleventyConfig.setUseGitIgnore(false);
    eleventyConfig.addPassthroughCopy("media");
    eleventyConfig.addPassthroughCopy({"media/icon.png": "favicon.ico"});

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
        value => `${value.getDate()}/${value.getMonth()+1}/${value.getFullYear()}`
    );

    eleventyConfig.addShortcode("icon", function (iconName) {
        const icon = simpleIcons.get(iconName);
        if (!icon) {
            throw Error(`Simple icon does not have ${iconName}`);
        }
        const svg = icon.svg;
        return "<svg class=\"icon\"".concat(svg.slice(4));
    });

    // Images and videos are wrapped in `div` to avoid markdown plugin wanting to wrap them in `p` tags

    eleventyConfig.addShortcode("image", function (src, alt) {
        const {height, width} = imageSize(path.join(__dirname, src));
        return `<div style="display: contents;"><img src="${src}" alt="${alt}" width="${width}" height="${height}"></div>`;
    });

    eleventyConfig.addShortcode("video", async function (src) {
        const {height, width} = await videoSize(path.join(__dirname, src));
        return `<div style="display: contents;"><video controls loop src="${src}" width="${width}" height="${height}"></video></div>`;
    });

    return {
        dir: {
            input: "src",
            output: "dist"
        }
    }
}
