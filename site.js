/* ===== EDIT ME ===== */
const ANNOUNCEMENT = {
  enabled: true, // set to true to show the bar
  text: "Welcome to the brand new City Metro official website! Please note this website is under development.",
  linkText: "Learn more",
  linkHref: "https://citymetro.xyz"
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
    <a class="logo" href="/" aria-label="City Metro home"><img src="https://alerts.citymetro.xyz/logo.png" alt="City Metro"></a>
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
  const cols = NAV.filter(n => n.items).map(n => `<div><h4>${n.label}</h4><ul>${n.items.map(li).join("")}</ul></div>`).join("");
  document.getElementById("site-footer").innerHTML = `<footer class="site-footer"><div class="container">
    <div class="footer-cols">${cols}</div>
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
