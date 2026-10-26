/* ===== EDIT ME ===== */
const ANNOUNCEMENT = {
  enabled: true, // set to true to show  bar
  text: "City Metro Single Sign-On is not working at this time.",
  linkText: "Learn more",
  linkHref: "https://status.citymetro.xyz/incident/1103899"
};
const NAV = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about", items: [
    { label: "Rail & Bus Lines", href: "/lines" },
    { label: "City Metro Shop", href: "https://shop.citymetro.xyz" },
    { label: "Museum", href: "https://museum.citymetro.xyz" },
    { label: "Support", href: "https://support.citymetro.xyz" },
    { label: "Republic State Railways", href: "https://rsr.citymetro.xyz" },
    { label: "City MetroLink", href: "https://metrolink.citymetro.xyz" },
    { label: "Web Services Status", href: "https://status.citymetro.xyz" },
    { label: "Customer Code of Conduct", href: "https://police.citymetro.xyz/customercodeofconduct.pdf" },
    { label: "Contact", href: "/contact" } ] },
  { label: "Fares", href: "/fares", items: [
    { label: "MyBrickPass", href: "https://mybrickpass.citymetro.xyz" } ] },
  { label: "Ride", items: [
    { label: "Trip Planner", href: "https://trip-planner.citymetro.xyz" },
    { label: "Map", href: "https://map.citymetro.xyz" },
    { label: "Alerts", href: "https://alerts.citymetro.xyz" },
    { label: "Single Sign-On", href: "https://auth.citymetro.xyz" } ] },
  { label: "Safety", href: "/safety", items: [
    { label: "Transit Police", href: "https://police.citymetro.xyz" },
    { label: "Lego City Police", href: "https://lcpolice.wordpress.com" },
    { label: "LCSD", href: "https://lcsdonline.wordpress.com" } ] }
];

// Noupe assistant: paste the embed code Noupe gives you between the backticks.
// (Leave empty to hide the assistant.)
const NOUPE_SNIPPET = `<script src='https://www.noupe.com/embed/01a0f9a8fe0870008c410c945c6507b28d60.js'></script>`;
// Footer social links. Add or remove lines as needed.
const SOCIAL = [
  { label: "Instagram", href: "https://instagram.com/citymetroalerts",
    icon: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>' },
  { label: "X", href: "https://x.com/CityMetroAlert",
    icon: '<path d="M4 4l16 16M20 4L4 20" stroke-width="2.4"/>' },
  { label: "YouTube", href: "https://youtube.com/@CityMetroTransit",
    icon: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/>' },
  { label: "Pixelfed", href: "https://pixelfed.social/citymetro",
    icon: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>' },
  { label: "Mastodon", href: "https://mastodon.social/@citymetro",
    icon: '<path d="M5 4h14a2 2 0 0 1 2 2v7a5 5 0 0 1-5 5h-3l-5 3v-3a5 5 0 0 1-3-4.6V6a2 2 0 0 1 2-2z"/><path d="M8 14V9.5a1.5 1.5 0 0 1 3 0V14M11 11a1.5 1.5 0 0 1 3 0V14"/>', rel: " me" }
];
/* ==================== */

const path = location.pathname.replace(/\.html$/, "").replace(/\/$/, "") || "/";
const li = (i) => `<li><a href="${i.href}">${i.label}</a></li>`;

function renderHeader() {
  const items = NAV.map(n => n.items && n.href
    ? `<li class="has-dd split"><a class="nav-link ${path === n.href ? "active" : ""}" href="${n.href}">${n.label}</a><button class="dd-toggle" aria-label="${n.label} menu" aria-expanded="false"></button><ul class="dd-menu">${n.items.map(li).join("")}</ul></li>`
    : n.items
    ? `<li class="has-dd"><button class="dd-toggle" aria-expanded="false">${n.label}</button><ul class="dd-menu">${n.items.map(li).join("")}</ul></li>`
    : `<li><a class="nav-link ${path === n.href ? "active" : ""}" href="${n.href}">${n.label}</a></li>`).join("");
  let bar = "";
  if (ANNOUNCEMENT.enabled && !sessionStorage.getItem("announceClosed")) {
    bar = `<div class="announce" role="region" aria-label="Announcement">${ANNOUNCEMENT.text} ${ANNOUNCEMENT.linkHref ? `<a href="${ANNOUNCEMENT.linkHref}">${ANNOUNCEMENT.linkText}</a>` : ""}<button aria-label="Dismiss">&times;</button></div>`;
  }
  document.getElementById("site-header").innerHTML = `${bar}
  <header class="site-header"><div class="container header-inner">
    <a class="logo" href="/" aria-label="City Metro home"><img src="/logo.png" alt="City Metro"></a>
    <button class="menu-btn" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="nav" aria-label="Main"><ul class="nav-list">${items}</ul><div class="nav-cta-wrap"><a class="btn nav-cta" href="/contact">Contact Us</a></div></nav>
  </div></header>`;

  const logoImg = document.querySelector(".logo img"); // CSP blocks inline onerror, so attach it here
  if (logoImg) logoImg.addEventListener("error", () => logoImg.replaceWith("m"), { once: true });
  const btn = document.querySelector(".menu-btn"), nav = document.querySelector(".nav");
  btn.onclick = () => { const o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", o); document.body.style.overflow = o ? "hidden" : ""; };
  document.querySelectorAll(".dd-toggle").forEach(t => t.onclick = (e) => {
    e.stopPropagation();
    const p = t.parentElement, wasOpen = p.classList.contains("open");
    document.querySelectorAll(".has-dd").forEach(x => { x.classList.remove("open"); x.querySelector(".dd-toggle").setAttribute("aria-expanded", "false"); });
    if (!wasOpen) { p.classList.add("open"); t.setAttribute("aria-expanded", "true"); }
  });
  document.addEventListener("click", () => document.querySelectorAll(".has-dd").forEach(x => x.classList.remove("open")));
  const x = document.querySelector(".announce button");
  if (x) x.onclick = () => { sessionStorage.setItem("announceClosed", "1"); x.parentElement.remove(); };
}

function renderFooter() {
  const n = document.body.dataset.footerNote;
  const note = n ? `<p class="footer-note">${n}</p>` : "";
  const social = SOCIAL.map(s => `<a href="${s.href}" target="_blank" rel="noopener noreferrer${s.rel || ""}" aria-label="${s.label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.icon}</svg>${s.label}</a>`).join("");
  const cols = NAV.filter(n => n.items).map(n => `<div><h4>${n.label}</h4><ul>${n.items.map(li).join("")}</ul></div>`).join("");
  document.getElementById("site-footer").innerHTML = `<footer class="site-footer"><div class="container">
    <div class="footer-cols">${cols}</div>
    <div class="social" aria-label="Social media">${social}</div>
    <div class="legal"><span>© City Metro Transit. A subsidiary of the Republic States Railway and Transportation Authority.</span>
    <span><a href="/terms">Terms of Service</a> &nbsp;·&nbsp; <a href="/privacy">Privacy Policy</a></span></div>${note}
  </div></footer>`;
}
renderHeader(); renderFooter();

function loadNoupe() {
  if (!NOUPE_SNIPPET.trim()) return;
  const t = document.createElement("template");
  t.innerHTML = NOUPE_SNIPPET;
  t.content.childNodes.forEach(node => {
    if (node.nodeName === "SCRIPT") { // re-create so the browser runs it
      const s = document.createElement("script");
      [...node.attributes].forEach(a => s.setAttribute(a.name, a.value));
      s.textContent = node.textContent;
      document.body.appendChild(s);
    } else document.body.appendChild(node.cloneNode(true));
  });
}
loadNoupe();
