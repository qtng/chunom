// Old address of the menu bar. There is one navigation.js for both sites, in qtng/qatt (https://qatt.org/js/navigation.js); pages load it from there.
// This file only passes pages on that still use the old address (the landing pages of qtng/pages that were generated before the change).
(function() {
    const script = document.createElement("script");
    script.src = "https://qatt.org/js/navigation.js";
    document.head.appendChild(script);
})();
