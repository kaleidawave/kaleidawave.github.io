module.exports = {
    production: (process.env.CI || process.env.PRODUCTION) === "true"
};