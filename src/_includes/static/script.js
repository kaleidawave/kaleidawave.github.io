if (localStorage.getItem("theme") === null) {
    changeScheme();
} else {
    updateThemeClass();
}

function changeScheme(darkTheme = null) {
    if (darkTheme === null) {
        if ("matchMedia" in window) {
            darkTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        } else {
            darkTheme = false;
        }
    }
    localStorage.setItem("theme", darkTheme ? "dark" : "light");
    updateThemeClass();
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

{
    const themeSwitch = document.querySelector("#toggle-theme");
    themeSwitch.checked = localStorage.getItem("theme") !== "dark";
    themeSwitch.addEventListener("change", (ev) => {
        const darkTheme = !ev.target.checked;
        changeScheme(darkTheme);
    });
}
    
document.addEventListener("click", (ev) => {
    if (ev.target.matches(".post > *:is(h2, h3, h4, h5)")) {
        const id = ev.target.getAttribute("id");
        if (id !== null) {
            location.href = '#' + id;
        }
    }
});

// TODO temp hack for highlighted rows in code blocks
for (const element of document.querySelectorAll("[data-highlight]")) {
    const indexes = element.getAttribute("data-highlight").split(",").map(a => parseInt(a));
    for (const pres of element.children[0].children) {
        // TODO adjacent indices don't style well, could do something here
        for (const index of indexes) {
            const line = pres.children[0].children[index];
            const firstChild = line.children[0];
            const newContent = firstChild.textContent.trimLeft();
            const indent = firstChild.textContent.length - newContent.length;
            firstChild.childNodes[0].data = newContent;
            line.style.marginLeft = indent + 'ch';
            line.classList.add("highlight");
        }   
    }
}
