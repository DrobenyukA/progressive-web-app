module.exports = {
    "globDirectory": "public/",
    "globPatterns": [
        "**/*.{html,ico,json,js,css,png,jpg}"
    ],
    "swSrc": "service-worker/base.js",
    "swDest": "public/service-worker.js",
    "globIgnores": [
        "../workbox-cli-config.js",
        "src/images/icons/**",
        "help/**"
    ]
};