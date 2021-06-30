if (localStorage.getItem("theme") === null) {
    onSchemeChange();
}

function onSchemeChange(darkTheme = null) {
    if (darkTheme === null) {
        if ("matchMedia" in window) {
            darkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        } else {
            darkTheme = false;
        }
    }
    localStorage.setItem("theme", darkTheme ? "dark" : "light");
}

function updateThemeClass(value = null) {
    if (value === null) {
        value = localStorage.getItem("theme") === "dark";
    }
    if (value) {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

updateThemeClass();

window.addEventListener("hashchange", () => {
    window.scrollBy(0, -100);
}, false);

if (location.hash) {
    window.onload = () => { window.scrollBy(0, -100); }
}