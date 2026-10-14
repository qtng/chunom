// Menu bar of the Chunom site (the repository qtng/chunom, served under /chunom/ of chunom.org). qatt.org has its own copy in qtng/qatt (js/navigation.js).
// The two sites are separate: the links to the other site are absolute (QATT_SITE), the links of this site start at the root.
(function() {
    const QATT_SITE = "https://qatt.org";
    const navConfig = {
        title: "Chunom.org",
        home: "/chunom/",
        own: "link-nom",
        sections: [
            {
                header: "Chữ Nôm",
                themeClass: "text-warning",
                linkClass: "link-nom",
                links: [
                    { name: "Character Search", bar: "Search", barOrder: 1, url: "/chunom/index.html", icon: "bi-search" },
                    { name: "Practice / Decks", bar: "Practice", barOrder: 4, url: "/chunom/decks/index.html", icon: "bi-mortarboard" },
                    { name: "Chữ Nôm Writer", bar: "Write", barOrder: 3, url: "/chunom/writer.html", icon: "bi-pencil-square" },
                    { name: "Dictionary: Génibrel 1898", bar: "Dictionaries", barOrder: 2, url: "/chunom/dict/genibrel.html", icon: "bi-book" },
                    { name: "Dictionary: Bonet 1899", url: "/chunom/dict/bonet.html", icon: "bi-book" },
                ]
            },
            {
                header: "Quốc Âm Tân Tự (QATT)",
                themeClass: "text-info",
                linkClass: "link-qatt",
                site: QATT_SITE,
                links: [
                    { name: "Quốc Âm Tân Tự", bar: "Home", url: "/index.html", icon: "bi-house" },
                    { name: "QATT Symbols", bar: "Symbols", url: "/symbols.html", icon: "bi-book" },
                    { name: "QATT Writer", bar: "Write", url: "/editor.html", icon: "bi-pencil-square" },
                    { name: "QATT Decodings", bar: "Decodings", url: "/decodings.html", icon: "bi-puzzle" },
                    { name: "QATT Unicode", url: "/unicode.html", icon: "bi-fonts" },
                    { name: "QATT Wiki", url: "/wiki.html", icon: "bi-wikipedia" },
                ]
            }
        ]
    };

        const vendor = "https://qatt.org/vendor/"; // Bootstrap and Bootstrap Icons are those of qatt.org

    function injectDependencies() {
        if (!document.querySelector('link[href*="bootstrap-icons"]')) {
            const icons = document.createElement('link');
            icons.rel = 'stylesheet';
            icons.href = vendor + 'bootstrap-icons/bootstrap-icons.min.css';
            document.head.appendChild(icons);
        }

        if (typeof bootstrap === 'undefined' && !document.querySelector('script[src*="bootstrap"]')) {
            const bsScript = document.createElement('script');
            bsScript.src = vendor + 'bootstrap/js/bootstrap.bundle.min.js';
            document.head.appendChild(bsScript);
        }

        const style = document.createElement('style');
        style.textContent = `
            @media (min-width: 1400px) {
                .container, .container-lg, .container-md, .container-sm, .container-xl, .container-xxl {
                    max-width: 1040px;
                }
            }
            svg { /* global defaults for rendered QATT SVGs */
              stroke-linecap: square;
              stroke-linejoin: square;
            }
            .nav-backdrop{
              height: 60px; /* the page content starts below it, see the body padding */
              background: rgba(33, 37, 41, 0.95);
              backdrop-filter: blur(15px);
            }
            .navmenu-backdrop{
              background: rgba(33, 37, 41, 0.5);
              backdrop-filter: blur(10px);
            }
            .nav-section-header {
                font-size: 0.75rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.08rem;
                padding: 1.5rem 1.25rem 0.5rem;
            }
            .offcanvas-nav-link {
                color: #adb5bd;
                padding: 0.7rem 1.25rem;
                display: flex;
                align-items: center;
                text-decoration: none;
                transition: all 0.2s ease;
                border-left: 3px solid transparent;
            }
            .link-nom.active, .link-nom:hover {
                border-left-color: var(--bs-warning);
                background: linear-gradient(90deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0) 100%);
                color: #fff !important;
            }
            .link-qatt.active, .link-qatt:hover {
                border-left-color: var(--bs-info);
                background: linear-gradient(90deg, rgba(13, 202, 240, 0.1) 0%, rgba(13, 202, 240, 0) 100%);
                color: #fff !important;
            }
            .offcanvas-nav-link i { margin-right: 12px; width: 20px; text-align: center; }
            /* bottom bar of the phone: the links of the current block (those with a "bar" label) and the menu */
            .bottom-bar { display: none; }
            @media (max-width: 767.98px) and (min-height: 480px) {
                body.has-bottom-bar { padding-bottom: calc(60px + env(safe-area-inset-bottom)); }
                .bottom-bar {
                    display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 1030;
                    padding-bottom: env(safe-area-inset-bottom);
                    background: rgba(33, 37, 41, 0.95); backdrop-filter: blur(15px);
                    border-top: 1px solid #495057;
                }
                .bottom-bar.typing { display: none; } /* while the on-screen keyboard is open */
                body.bar-typing { padding-bottom: 0; }
                .bottom-bar a, .bottom-bar button {
                    flex: 1 1 0; min-width: 0; height: 60px; border: 0; background: none; color: #adb5bd;
                    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
                    font-size: .68rem; text-decoration: none; border-top: 3px solid transparent; white-space: nowrap;
                }
                .bottom-bar i { font-size: 1.35rem; line-height: 1; }
                .bottom-bar .active { color: #fff; border-top-color: var(--bar-accent); }
                .bottom-bar .active i { color: var(--bar-accent); }
            }
            #siteOffcanvas { width: 280px; transition: transform 0.3s ease-in-out; }
            .powered-by { text-align: center; font-size: .7rem; padding: 1.5rem 1rem 1rem; }
            .powered-by a { color: inherit; opacity: .45; text-decoration: none; }
            .powered-by a:hover { opacity: .9; text-decoration: underline; }
        `;
        document.head.appendChild(style);
    }

    // footnote "powered by chunom.org": links to license.html, the hash lists the scripts, styles and fonts this page has loaded
    // (taken when the link is used, so also the files loaded later are in it)
    function injectFooter(licenseUrl) {
        const sources = () => {
            const seen = new Set();
            performance.getEntriesByType('resource').forEach(e => {
                const url = new URL(e.name, location.href);
                if (!/^https?:$/.test(url.protocol) || /license\.html$/.test(url.pathname) || !/\.(js|css|woff2?|ttf|otf)$/i.test(url.pathname)) return;
                seen.add(url.origin === location.origin ? url.pathname : url.origin + url.pathname);
            });
            return [...seen];
        };
        const footer = document.createElement('div');
        footer.className = 'powered-by';
        const link = document.createElement('a');
        link.textContent = 'powered by chunom.org';
        link.title = 'Licenses and the files this page uses';
        const update = () => { link.href = `${licenseUrl}#${sources().map(encodeURIComponent).join(',')}`; };
        update();
        ['pointerdown', 'focus', 'touchstart', 'contextmenu'].forEach(t => link.addEventListener(t, update));
        window.addEventListener('load', update);
        footer.appendChild(link);
        document.body.appendChild(footer);
    }

    function injectNav() {
        const home = navConfig.home;
        const logo = "/chunom/img/chunom-logo.gif";
        const brandTitle = navConfig.title;
        const sections = navConfig.sections;
        if (!document.querySelector('link[rel~="icon"]')) {
            document.head.insertAdjacentHTML('beforeend', `<link rel="icon" type="image/svg+xml" href="/chunom/img/chunom-favicon.svg">
                <link rel="icon" type="image/png" sizes="32x32" href="/chunom/img/chunom-favicon-32.png">
                <link rel="apple-touch-icon" href="/chunom/img/chunom-apple-touch-icon.png">`);
        }

        const currentPath = window.location.pathname;
        const navId = "siteOffcanvas";

        const header = document.createElement('nav');
        header.className = "nav-backdrop navbar navbar-dark fixed-top border-bottom border-secondary shadow-sm";
        header.innerHTML = `
            <div class="container-fluid">
                <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="${home}">
                    <img src="${logo}" alt="${brandTitle}" height="42" style="width:auto;border-radius:4px">
                </a>
                <div class="ms-auto d-flex align-items-center">
                    <button class="navbar-toggler border-0" type="button" id="navTogglerCustom">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                </div>
            </div>
        `;

        const offcanvas = document.createElement('div');
        offcanvas.className = "navmenu-backdrop offcanvas offcanvas-end text-light";
        offcanvas.id = navId;
        offcanvas.tabIndex = "-1";

        const sectionsHtml = sections.map(section => {
            const linksHtml = section.links.map(link => {
                const isActive = !section.site && (currentPath === link.url || currentPath === link.url.replace(/index\.html$/, ''));
                return `<a href="${section.site || ''}${link.url}" class="offcanvas-nav-link ${section.linkClass} ${isActive ? 'active' : ''}">
                            <i class="bi ${link.icon}"></i> ${link.name}
                        </a>`;
            }).join('');
            return `<div class="nav-section-header ${section.themeClass}">${section.header}</div>
                    <div class="nav flex-column">${linksHtml}</div>`;
        }).join('');

        offcanvas.innerHTML = `
            <div class="offcanvas-header border-bottom border-secondary">
                <h5 class="offcanvas-title fw-bold text-white d-flex align-items-center gap-2"><img src="${logo}" alt="${brandTitle}" height="34" style="width:auto;border-radius:4px"></h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
            </div>
            <div class="offcanvas-body p-0">${sectionsHtml}</div>
        `;

        // bottom bar for phones: only the links of the block of this page; not on the immersive page
        const ownBottomBar = /\/immersive\.html$/.test(currentPath);
        if (!ownBottomBar) {
            const block = sections.find(sec => sec.links.some(l => l.bar));
            const own = sections.find(sec => sec.linkClass === navConfig.own) || block;
            const barLinks = own.links.filter(l => l.bar).sort((a, b) => (a.barOrder ?? 0) - (b.barOrder ?? 0)).map(link => {
                const isActive = currentPath === link.url || currentPath === link.url.replace(/index\.html$/, '');
                return `<a href="${link.url}" class="${isActive ? 'active' : ''}"><i class="bi ${link.icon}"></i>${link.bar}</a>`;
            }).join('');
            const bar = document.createElement('nav');
            bar.className = 'bottom-bar';
            bar.setAttribute('aria-label', 'Main');
            bar.style.setProperty('--bar-accent', 'var(--bs-warning)');
            bar.innerHTML = `${barLinks}<button type="button" id="barMenu"><i class="bi bi-list"></i>Menu</button>`;
            document.body.appendChild(bar);
            document.body.classList.add('has-bottom-bar');
            bar.querySelector('#barMenu').addEventListener('click', () => document.getElementById('navTogglerCustom').click());
            // hide it while the on-screen keyboard is open (the visual viewport is much shorter than the window)
            // or while the user has put the cursor in a text field (a field focused by the page itself does not count)
            let keyboard = false, field = false, lastTouch = 0;
            const update = () => {
                const hide = keyboard || field;
                bar.classList.toggle('typing', hide);
                document.body.classList.toggle('bar-typing', hide);
            };
            const isField = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea, [contenteditable=true]');
            ['pointerdown', 'touchstart', 'keydown'].forEach(t => document.addEventListener(t, () => { lastTouch = Date.now(); }, true));
            document.addEventListener('focusin', e => { if (isField(e.target) && Date.now() - lastTouch < 800) { field = true; update(); } });
            document.addEventListener('focusout', () => { field = false; update(); });
            if (window.visualViewport) {
                const vv = window.visualViewport;
                vv.addEventListener('resize', () => { keyboard = window.innerHeight - vv.height > 150; update(); });
            }
            // the safe area below the bar needs viewport-fit=cover
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport && !/viewport-fit/.test(viewport.content)) viewport.content += ', viewport-fit=cover';
        }

        document.body.style.paddingTop = "60px";
        document.body.prepend(header);
        document.body.appendChild(offcanvas);
        if (!ownBottomBar) injectFooter("https://qatt.org/license.html");

        const initOffcanvas = () => {
            const toggler = document.getElementById('navTogglerCustom');
            const offcanvasEl = document.getElementById(navId);
            
            if (toggler && offcanvasEl && typeof bootstrap !== 'undefined') {
                const bsOffcanvas = new bootstrap.Offcanvas(offcanvasEl);
                toggler.addEventListener('click', (e) => {
                    e.preventDefault();
                    bsOffcanvas.toggle();
                });
            } else if (typeof bootstrap === 'undefined') {
                setTimeout(initOffcanvas, 200);
            }
        };
        initOffcanvas();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            injectDependencies();
            injectNav();
        });
    } else {
        injectDependencies();
        injectNav();
    }
})();
