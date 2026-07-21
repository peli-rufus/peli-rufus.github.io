/* DFIR Portfolio — main.js */

// NAV SCROLL EFFECT
const nav = document.getElementById('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// HAMBURGER MENU
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// TYPEWRITER EFFECT (hero terminal)
const typewriterEl = document.getElementById('typewriter');
const termOutput = document.getElementById('term-output');
if (typewriterEl && termOutput) {
  const lines = [
    { cmd: 'whoami', output: ['dfir_engineer', '// Digital Forensics & Incident Response'] },
    { cmd: 'cat skills.txt', output: ['Memory Forensics | Threat Hunting', 'Malware Analysis | Log Analysis | Tool Dev'] },
    { cmd: 'ls ./arsenal/', output: ['triagekit/  sigmaforge/  loglens/  ...and more'] },
    { cmd: 'echo $STATUS', output: ['> Ready to investigate. Let\'s get to work.'] },
  ];

  let lineIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  let outputQueue = [];

  function typeNextLine() {
    if (lineIdx >= lines.length) { lineIdx = 0; termOutput.innerHTML = ''; }
    const line = lines[lineIdx];
    const full = line.cmd;

    if (!isDeleting && charIdx <= full.length) {
      typewriterEl.textContent = full.slice(0, charIdx++);
      setTimeout(typeNextLine, 60);
    } else if (!isDeleting && charIdx > full.length) {
      isDeleting = false;
      // Show output
      line.output.forEach((out, i) => {
        setTimeout(() => {
          const p = document.createElement('p');
          p.className = i === 0 ? 'term-green' : 'term-dim';
          p.textContent = out;
          termOutput.appendChild(p);
        }, i * 200);
      });
      setTimeout(() => {
        // Clear and move to next
        typewriterEl.textContent = '';
        termOutput.innerHTML = '';
        charIdx = 0;
        lineIdx++;
        typeNextLine();
      }, 2800);
    }
  }
  setTimeout(typeNextLine, 800);
}

// COUNTER ANIMATION
function animateCounters() {
  const counters = document.querySelectorAll('.stat-num');
  counters.forEach(el => {
    const target = parseInt(el.dataset.target);
    const duration = 1500;
    const start = performance.now();
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  });
}

// SCROLL REVEAL
// Add reveal class FIRST, then observe (order matters!)
document.querySelectorAll('.section-header, .post-card, .tool-card, .cert-card, .blog-list-item, .tool-full-card, .timeline-item, .skill-group').forEach(el => {
  el.classList.add('reveal');
});
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
revealEls.forEach(el => revealObserver.observe(el));

// COUNTER OBSERVER
const statsEl = document.querySelector('.hero-stats');
if (statsEl) {
  const statsObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      animateCounters();
      statsObserver.disconnect();
    }
  }, { threshold: 0.5 });
  statsObserver.observe(statsEl);
}

// BLOG FILTER
const filterBtns = document.querySelectorAll('.filter-btn');
const blogItems = document.querySelectorAll('.blog-list-item[data-category]');
if (filterBtns.length && blogItems.length) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      blogItems.forEach(item => {
        item.style.display = (cat === 'all' || item.dataset.category === cat) ? '' : 'none';
      });
    });
  });
}

// Hard fallback — ensure nothing stays hidden
setTimeout(() => {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}, 1000);
