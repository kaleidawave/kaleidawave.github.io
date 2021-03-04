const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function (eleventyConfig) {
    eleventyConfig.addPlugin(syntaxHighlight);
    eleventyConfig.addPassthroughCopy("images");

    return {
        dir: {
            input: "src",
            output: "dist"
        }
    }
}