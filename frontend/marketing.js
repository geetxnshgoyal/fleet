document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector(".mobile-menu");
  const navLinks = document.querySelectorAll('a[href^="#"]');
  const heroSection = document.querySelector("[data-hero-sequence]");
  const heroLines = document.querySelectorAll(".hero-line");
  const stackSection = document.querySelector("[data-stack-section]");
  const stackCopies = document.querySelectorAll("[data-stack-copy]");
  const stackMedia = document.querySelectorAll("[data-stack-media]");
  const autoplayVideos = document.querySelectorAll("video[autoplay]");
  const contactForm = document.querySelector(".contact-form");

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const syncVideoPlayback = () => {
    autoplayVideos.forEach((video) => {
      const panel = video.closest("[data-stack-media]");
      const shouldPause = panel && !panel.classList.contains("is-active");

      if (shouldPause) {
        if (!video.paused) {
          video.pause();
        }
        return;
      }

      if (!video.paused) {
        return;
      }

      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(() => {});
      }
    });
  };

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const isOpen = body.classList.toggle("menu-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      if (mobileMenu) {
        mobileMenu.setAttribute("aria-hidden", String(!isOpen));
      }
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      const target = href ? document.querySelector(href) : null;

      if (!target) {
        return;
      }

      event.preventDefault();
      body.classList.remove("menu-open");
      if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", "false");
      }
      if (mobileMenu) {
        mobileMenu.setAttribute("aria-hidden", "true");
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  function updateHeroSequence() {
    if (!heroSection || !heroLines.length) {
      return;
    }

    const rect = heroSection.getBoundingClientRect();
    const total = Math.max(heroSection.offsetHeight - window.innerHeight, 1);
    const progress = clamp(-rect.top / total, 0, 0.999);
    const activeIndex = Math.floor(progress * heroLines.length);

    heroSection.style.setProperty("--hero-progress", progress.toFixed(3));

    heroLines.forEach((line, index) => {
      line.classList.toggle("is-active", index === activeIndex);
      line.classList.toggle("is-past", index < activeIndex);
    });
  }

  function updateStackSection() {
    if (!stackSection || !stackCopies.length || !stackMedia.length) {
      return;
    }

    const rect = stackSection.getBoundingClientRect();
    const total = Math.max(stackSection.offsetHeight - window.innerHeight, 1);
    const progress = clamp(-rect.top / total, 0, 0.999);
    const activeIndex = Math.floor(progress * stackCopies.length);

    stackCopies.forEach((item, index) => {
      item.classList.toggle("is-active", index === activeIndex);
    });

    stackMedia.forEach((item, index) => {
      item.classList.toggle("is-active", index === activeIndex);
    });

    syncVideoPlayback();
  }

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute("id");
        if (!id) {
          return;
        }

        const matching = document.querySelectorAll(`.site-nav a[href="#${id}"]`);
        matching.forEach((link) => {
          link.classList.toggle("is-active", entry.isIntersecting);
        });
      });
    },
    {
      threshold: 0.45,
      rootMargin: "-15% 0px -45% 0px",
    }
  );

  document.querySelectorAll("section[id]").forEach((section) => {
    sectionObserver.observe(section);
  });

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const submitButton = contactForm.querySelector(".form-submit");

      if (!submitButton) {
        return;
      }

      const originalText = submitButton.textContent;
      submitButton.textContent = "SENT";
      submitButton.disabled = true;

      window.setTimeout(() => {
        contactForm.reset();
        submitButton.textContent = originalText;
        submitButton.disabled = false;
      }, 1800);
    });
  }

  function onScroll() {
    updateHeroSequence();
    updateStackSection();
  }

  syncVideoPlayback();
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
});
