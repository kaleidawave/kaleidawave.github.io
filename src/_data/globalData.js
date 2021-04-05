console.log(process.env);

module.exports = {
    production: process.env.NODE_ENV === "production"
};