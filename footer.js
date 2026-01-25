/**
 * Shared footer renderer
 */
(function renderFooter() {
  const footerEl = document.getElementById('siteFooter');
  if (!footerEl) return;

  footerEl.className = 'site-footer-new';
  footerEl.setAttribute('role', 'contentinfo');

  footerEl.innerHTML = `
    <div class="footer-new-inner">
      <div class="footer-columns">
        <div class="footer-column">
          <h3 class="footer-brand-title">Doodle Dash</h3>
        </div>

        <div class="footer-column">
          <h3 class="footer-column-title">Play</h3>
          <ul class="footer-links-list">
            <li><a href="index.html">Home</a></li>
            <li><a href="races.html">Races</a></li>
            <li><a href="youtube.html">YouTube Channel</a></li>
            <li><a href="garage.html">Garage</a></li>
            <li><a href="help.html">Help</a></li>
          </ul>
        </div>

        <div class="footer-column">
          <h3 class="footer-column-title">Learn</h3>
          <ul class="footer-links-list">
            <li><a href="faq.html">FAQ</a></li>
            <li><a href="tutorial.html">Tutorial</a></li>
            <li><a href="blog.html">Blog</a></li>
          </ul>
        </div>

        <div class="footer-column">
          <h3 class="footer-column-title">Company</h3>
          <ul class="footer-links-list">
            <li><a href="about.html">About</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>

          <h3 class="footer-column-title footer-column-title-secondary">Terms and Policies</h3>
          <ul class="footer-links-list">
            <li><a href="privacy.html">Privacy Policy</a></li>
            <li><a href="terms.html">Terms of Use</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-copyright">
        © <span id="footerYear"></span> Doodle Dash | <span id="versionInfo"></span>
      </div>
    </div>
  `;

  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const versionEl = document.getElementById('versionInfo');
  if (versionEl) {
    const now = new Date();
    const day = now.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    versionEl.textContent = `Version 0.57 (${day}${suffix} ${month} ${year} ${hours}:${minutes})`;
  }
})();