/* ═══════════════════════════════════════════
   FLEETFOX — Interactive Logic
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ── EmailJS Init ─────────────────────────
  // TODO: Replace with your actual EmailJS credentials
  // 1. Sign up free at https://www.emailjs.com
  // 2. Add Gmail service (service ID)
  // 3. Create email template with variables: {{name}}, {{email}}, {{company}}, {{phone}}, {{message}}
  // 4. Replace the IDs below
  const EMAILJS_PUBLIC_KEY = 'I6Kar3pzmlameEIHh';     // Dashboard > Account > Public Key
  const EMAILJS_SERVICE_ID = 'service_zz2uc41';     // Dashboard > Email Services
  const EMAILJS_TEMPLATE_ID = 'template_dx1mzaq';   // Dashboard > Email Templates

  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }

  // ── Navbar scroll effect ─────────────────
  const nav = document.getElementById('main-nav');
  const header = document.getElementById('site-header');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 80) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  }, { passive: true });

  // ── Mobile toggle ────────────────────────
  const toggle = document.getElementById('mobile-toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.classList.toggle('active');
  });

  // Close mobile nav on link click
  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('active');
    });
  });

  // ── Smooth scroll for anchor links ───────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 100;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ── Tab switcher ─────────────────────────
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`content-${tabId}`).classList.add('active');
    });
  });

  // ── Scroll reveal / intersection observer ──
  const revealElements = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ── Animated stat counters ───────────────
  const statNumbers = document.querySelectorAll('.stat-number');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.target);
        const duration = 2000;
        const start = performance.now();
        const isFloat = target % 1 !== 0;

        const animate = (currentTime) => {
          const elapsed = currentTime - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = eased * target;

          el.textContent = isFloat ? current.toFixed(1) : Math.round(current);

          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };

        requestAnimationFrame(animate);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => counterObserver.observe(el));

  // ── Parallax on hero ─────────────────────
  const heroVideo = document.getElementById('hero-video');
  const heroContent = document.getElementById('hero-content');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const heroHeight = document.getElementById('hero').offsetHeight;

    if (scrollY < heroHeight) {
      const factor = scrollY / heroHeight;
      if (heroVideo) {
        heroVideo.style.transform = `scale(${1 + factor * 0.1})`;
      }
      if (heroContent) {
        heroContent.style.transform = `translateY(${scrollY * 0.3}px)`;
        heroContent.style.opacity = 1 - factor * 0.8;
      }
    }
  }, { passive: true });

  // ── Hide scroll hint on scroll ───────────
  const scrollHint = document.getElementById('scroll-hint');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 200 && scrollHint) {
      scrollHint.style.opacity = '0';
      scrollHint.style.pointerEvents = 'none';
    }
  }, { passive: true });

  // ── Form submission with EmailJS ─────────
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('form-submit');
      const originalText = btn.textContent;

      // Gather form data
      const templateParams = {
        name:    document.getElementById('form-name').value,
        email:   document.getElementById('form-email').value,
        company: document.getElementById('form-company').value,
        phone:   document.getElementById('form-phone').value,
        message: document.getElementById('form-message').value,
        title:   document.getElementById('form-name').value,
        time:    new Date().toLocaleString(),
      };

      // Show sending state
      btn.textContent = 'Sending...';
      btn.disabled = true;
      btn.style.opacity = '0.7';

      try {
        if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
          // Send via EmailJS
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
          btn.textContent = 'Message sent ✓';
          btn.style.background = '#CCFF00';
          btn.style.color = '#0A0C0B';
          btn.style.opacity = '1';
        } else {
          // Fallback: mailto link if EmailJS not configured
          const subject = encodeURIComponent(`FleetFox Inquiry from ${templateParams.name}`);
          const body = encodeURIComponent(
            `Name: ${templateParams.name}\n` +
            `Email: ${templateParams.email}\n` +
            `Company: ${templateParams.company}\n` +
            `Phone: ${templateParams.phone}\n\n` +
            `Message:\n${templateParams.message}`
          );
          window.open(`mailto:info.fleetfox@gmail.com?subject=${subject}&body=${body}`, '_blank');
          btn.textContent = 'Message sent ✓';
          btn.style.background = '#CCFF00';
          btn.style.color = '#0A0C0B';
          btn.style.opacity = '1';
        }
      } catch (error) {
        console.error('Email send failed:', error);
        const errMsg = error?.text || error?.message || 'Unknown error';
        btn.textContent = `Error: ${errMsg}`;
        btn.style.background = '#ff4444';
        btn.style.color = '#fff';
        btn.style.opacity = '1';
      }

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.opacity = '';
        btn.disabled = false;
        form.reset();
      }, 3000);
    });
  }

  // ── Active nav link highlight on scroll ──
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active',
            link.getAttribute('href') === `#${id}`
          );
        });
      }
    });
  }, {
    threshold: 0.3,
    rootMargin: '-100px 0px -50% 0px'
  });

  sections.forEach(section => sectionObserver.observe(section));

});
