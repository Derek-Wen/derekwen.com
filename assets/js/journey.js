/* Journey Website */

// Page Transition
(function () {
  const transition = document.createElement('div');
  transition.id = 'page-transition';
  transition.innerHTML = `
    <div class="rect-bar" style="--i:0"></div>
    <div class="rect-bar" style="--i:1"></div>
    <div class="rect-bar" style="--i:2"></div>
    <div class="rect-bar" style="--i:3"></div>
    <div class="rect-bar" style="--i:4"></div>
    <div class="rect-bar" style="--i:5"></div>
  `;
  document.body.appendChild(transition);

  transition.classList.add('entering');
  setTimeout(() => {
    transition.classList.remove('entering');
    transition.classList.add('idle');
  }, 800);

  document.addEventListener('click', function (e) {
    const link = e.target.closest('a');
    if (link && link.href && !link.target && link.hostname === window.location.hostname) {
      if (link.getAttribute('href').startsWith('#')) return;

      e.preventDefault();
      transition.classList.remove('idle');
      transition.classList.add('leaving');
      setTimeout(() => {
        window.location.href = link.href;
      }, 800);
    }
  });
})();

// Cursor Switcher - hides fluid cursor for certain sections
class CursorSwitcher {
  constructor() {
    this.fluidContainer = document.querySelector('.fluid-cursor-container');
    this.currentMode = 'fluid';

    // Only these sections show the fluid cursor effect
    this.fluidSections = ['hero'];

    if ('ontouchstart' in window) return;

    this.init();
  }

  init() {
    const sections = document.querySelectorAll('section[id]');
    const footer = document.querySelector('.journey-footer');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
          const sectionId = entry.target.id || entry.target.tagName.toLowerCase();
          const shouldShowFluid = this.fluidSections.includes(sectionId);

          if (shouldShowFluid && this.currentMode !== 'fluid') {
            this.showFluid();
            this.currentMode = 'fluid';
          } else if (!shouldShowFluid && this.currentMode !== 'normal') {
            this.hideFluid();
            this.currentMode = 'normal';
          }
        }
      });
    }, {
      threshold: [0.3, 0.5],
      rootMargin: '-10% 0px -10% 0px'
    });

    sections.forEach(section => observer.observe(section));
    if (footer) observer.observe(footer);
  }

  showFluid() {
    if (this.fluidContainer) {
      this.fluidContainer.style.opacity = '1';
      this.fluidContainer.style.transition = 'opacity 0.3s ease';
    }
  }

  hideFluid() {
    if (this.fluidContainer) {
      this.fluidContainer.style.opacity = '0';
      this.fluidContainer.style.transition = 'opacity 0.3s ease';
    }
  }
}

// Cursor Trail
class SleekLineCursor {
  constructor() {
    this.cursorTrail = [];
    this.trailLength = 100;
    this.mouseX = 0;
    this.mouseY = 0;
    this.isVisible = false;

    // Check for touch device
    if ('ontouchstart' in window) {
      return;
    }

    this.init();
  }

  init() {
    // Create trailing line canvas
    this.trailCanvas = document.createElement('canvas');
    this.trailCanvas.className = 'sleek-cursor__trail';
    this.trailCanvas.width = window.innerWidth;
    this.trailCanvas.height = window.innerHeight;
    this.ctx = this.trailCanvas.getContext('2d');

    // Initialize trail points
    for (let i = 0; i < this.trailLength; i++) {
      this.cursorTrail.push({ x: 0, y: 0 });
    }

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .sleek-cursor__trail {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 99997;
        opacity: 0;
        transition: opacity 0.3s;
      }
      
      .sleek-cursor__trail.visible {
        opacity: 1;
      }
      
      @media (max-width: 768px), (hover: none) {
        .sleek-cursor__trail {
          display: none !important;
        }
      }
      
      @media (prefers-reduced-motion: reduce) {
        .sleek-cursor__trail {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(this.trailCanvas);

    // Event listeners
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseenter', () => this.show());
    document.addEventListener('mouseleave', () => this.hide());

    // Handle window resize
    window.addEventListener('resize', () => {
      this.trailCanvas.width = window.innerWidth;
      this.trailCanvas.height = window.innerHeight;
    });

    // Start animation
    this.animate();

    // Show after delay
    setTimeout(() => this.show(), 500);
  }

  onMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  show() {
    this.isVisible = true;
    this.trailCanvas.classList.add('visible');
  }

  hide() {
    this.isVisible = false;
    this.trailCanvas.classList.remove('visible');
  }

  animate() {
    // Update trail
    this.cursorTrail.unshift({ x: this.mouseX, y: this.mouseY });
    this.cursorTrail.pop();

    // Draw trail
    this.drawTrail();

    requestAnimationFrame(() => this.animate());
  }

  drawTrail() {
    this.ctx.clearRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);

    if (!this.isVisible) return;

    this.ctx.beginPath();
    this.ctx.moveTo(this.cursorTrail[0].x, this.cursorTrail[0].y);

    for (let i = 1; i < this.cursorTrail.length - 2; i++) {
      const xc = (this.cursorTrail[i].x + this.cursorTrail[i + 1].x) / 2;
      const yc = (this.cursorTrail[i].y + this.cursorTrail[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(this.cursorTrail[i].x, this.cursorTrail[i].y, xc, yc);
    }

    // Create gradient for trail - monochromatic with blue hint
    const gradient = this.ctx.createLinearGradient(
      this.cursorTrail[0].x, this.cursorTrail[0].y,
      this.cursorTrail[this.trailLength - 1].x, this.cursorTrail[this.trailLength - 1].y
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.3, 'rgba(200, 200, 200, 0.4)');
    gradient.addColorStop(0.6, 'rgba(74, 144, 217, 0.2)');
    gradient.addColorStop(1, 'rgba(74, 144, 217, 0)');

    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.stroke();
  }
}

// ============================================================
// AURORA BACKGROUND ANIMATION
// ============================================================
class AuroraBackground {
  constructor() {
    this.container = document.querySelector('.aurora-bg');
    if (!this.container) return;

    this.createOrbs();
    this.animateOrbs();
  }

  createOrbs() {
    // Create additional floating orbs for more dynamic effect
    const orbCount = 5;
    for (let i = 0; i < orbCount; i++) {
      const orb = document.createElement('div');
      orb.className = 'aurora-floating-orb';
      orb.style.cssText = `
        position: absolute;
        border-radius: 50%;
        filter: blur(${60 + Math.random() * 40}px);
        opacity: ${0.15 + Math.random() * 0.15};
        width: ${200 + Math.random() * 300}px;
        height: ${200 + Math.random() * 300}px;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        background: radial-gradient(circle, 
          ${this.getRandomColor()} 0%, 
          transparent 70%);
        animation: floatOrb${i} ${15 + Math.random() * 15}s ease-in-out infinite;
        pointer-events: none;
      `;
      this.container.appendChild(orb);

      // Add keyframes for this orb
      const keyframes = `
        @keyframes floatOrb${i} {
          0%, 100% { 
            transform: translate(0, 0) scale(1); 
          }
          25% { 
            transform: translate(${-30 + Math.random() * 60}px, ${-30 + Math.random() * 60}px) scale(${0.9 + Math.random() * 0.3}); 
          }
          50% { 
            transform: translate(${-30 + Math.random() * 60}px, ${-30 + Math.random() * 60}px) scale(${0.9 + Math.random() * 0.3}); 
          }
          75% { 
            transform: translate(${-30 + Math.random() * 60}px, ${-30 + Math.random() * 60}px) scale(${0.9 + Math.random() * 0.3}); 
          }
        }
      `;
      const styleSheet = document.createElement('style');
      styleSheet.textContent = keyframes;
      document.head.appendChild(styleSheet);
    }
  }

  getRandomColor() {
    const colors = [
      'rgba(74, 144, 217, 0.4)',
      'rgba(124, 58, 237, 0.35)',
      'rgba(34, 211, 238, 0.3)',
      'rgba(100, 181, 246, 0.35)',
      'rgba(139, 92, 246, 0.3)'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  animateOrbs() {
    // Additional scroll-based parallax for orbs
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      const orbs = this.container.querySelectorAll('.aurora-floating-orb');
      orbs.forEach((orb, i) => {
        const speed = 0.02 + (i * 0.01);
        orb.style.transform = `translateY(${scrollY * speed}px)`;
      });
    }, { passive: true });
  }
}

// ============================================================
// SCROLL PROGRESS INDICATOR
// ============================================================
function initScrollProgress() {
  const progressBar = document.querySelector('.scroll-progress__bar');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    progressBar.style.height = `${scrollPercent}%`; // Changed to height for vertical bar
  }, { passive: true });
}

// ============================================================
// FLOATING NAV
// ============================================================
function initFloatingNav() {
  const nav = document.querySelector('.floating-nav');
  const toggle = document.querySelector('.floating-nav__toggle');
  const links = document.querySelector('.floating-nav__links');
  const navLinks = document.querySelectorAll('.floating-nav__link');
  const sections = document.querySelectorAll('.journey-section[id]');

  // Mobile toggle
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) {
        links.classList.remove('open');
      }
    });
  }

  // Active section tracking
  if (sections.length === 0 || navLinks.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -60% 0px', threshold: 0 });

  sections.forEach(section => observer.observe(section));
}

// ============================================================
// REVEAL ANIMATIONS
// ============================================================
function initRevealAnimations() {
  const revealElements = document.querySelectorAll('.reveal, .timeline-item, .project-card, .gallery-item, .music-embed, .journey-section');
  if (revealElements.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('is-visible');
        }, index * 30);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0.1 });

  revealElements.forEach(el => observer.observe(el));
}

// ============================================================
// STAGGER REVEAL
// ============================================================
function initStaggerReveal() {
  const staggerGroups = document.querySelectorAll('.stagger-reveal');
  if (staggerGroups.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  staggerGroups.forEach(group => observer.observe(group));
}

// ============================================================
// SMOOTH SCROLL
// ============================================================
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Clean up URL by removing hash after scroll
        setTimeout(() => {
          history.replaceState(null, '', window.location.pathname);
        }, 100);
      }
    });
  });
}

// ============================================================
// TYPED.JS
// ============================================================
function initTyped() {
  const typedElement = document.querySelector('.typed');
  if (!typedElement || typeof Typed === 'undefined') return;

  const typedStrings = typedElement.dataset.typedItems;
  if (!typedStrings) return;

  new Typed('.typed', {
    strings: typedStrings.split(',').map(s => s.trim()),
    typeSpeed: 80,
    backSpeed: 40,
    backDelay: 2000,
    loop: true,
    cursorChar: '|'
  });
}

// ============================================================
// GSAP ANIMATIONS (if available)
// ============================================================
function initGSAPAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.log('GSAP not loaded, using fallback animations');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Parallax for aurora background
  gsap.to('.aurora-bg', {
    y: '30%',
    ease: 'none',
    scrollTrigger: {
      trigger: '.journey',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1
    }
  });

  // Section headings
  gsap.utils.toArray('.section-heading').forEach(heading => {
    gsap.from(heading, {
      y: 60,
      opacity: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: heading,
        start: 'top 85%',
        toggleActions: 'play none none reverse'
      }
    });
  });

  // Career Timeline Items - fade in from right to left
  gsap.utils.toArray('.timeline-item').forEach((item, index) => {
    gsap.from(item, {
      x: 60, // Always from right
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: item,
        start: 'top 80%',
        toggleActions: 'play none none reverse'
      }
    });

    // Animate the timeline dot
    const dot = item.querySelector('::before');
    gsap.from(item, {
      '--dot-scale': 0,
      duration: 0.5,
      delay: 0.2,
      ease: 'back.out(1.7)',
      scrollTrigger: {
        trigger: item,
        start: 'top 80%',
        toggleActions: 'play none none none'
      }
    });
  });

  // Timeline line draw animation - animates as you scroll
  const timelineLine = document.querySelector('.timeline-line');
  if (timelineLine) {
    gsap.to(timelineLine, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.timeline',
        start: 'top 70%',
        end: 'bottom 50%',
        scrub: 1
      }
    });
  }
}


// ============================================================
// SCROLL THREAD - SVG PATH DRAWING WITH GSAP
// ============================================================
class ScrollThread {
  constructor() {
    this.container = document.querySelector('.scroll-thread-container');
    this.svg = document.querySelector('.scroll-thread');
    this.path = document.querySelector('.scroll-thread__path');
    this.projects = document.querySelectorAll('.thread-project');

    if (!this.container || !this.svg || !this.path || this.projects.length === 0) {
      return;
    }

    this.init();
  }

  init() {
    // Generate the curvy path with 3 loops
    this.generatePath();

    // Setup GSAP ScrollTrigger animation
    this.setupScrollAnimation();

    // Setup project reveals
    this.setupProjectReveals();
  }

  generatePath() {
    const containerHeight = this.container.offsetHeight;
    const projectCount = this.projects.length;

    // Waypoints covering most of the container height
    const waypoints = [];
    const startY = 30; // Start near top
    const endY = containerHeight - 50; // End near bottom
    const totalHeight = endY - startY;
    const baseSpacing = totalHeight / Math.max(projectCount, 1);

    // Generate waypoints to cover the full vertical space
    for (let i = 0; i <= projectCount; i++) {
      // Organic spacing - slight variation
      const spacingVariation = 0.9 + Math.random() * 0.2;
      const y = startY + (i * baseSpacing * spacingVariation);

      // Wide horizontal spread
      const xBase = i % 2 === 0 ? 20 : 80;
      const xVariation = (Math.random() - 0.5) * 15;
      const x = Math.max(10, Math.min(90, xBase + xVariation));

      waypoints.push({ x, y: (y / containerHeight) * 2000 }); // Scale to viewBox height
    }

    // Generate path with curves and decorative loops
    const pathData = this.generateOrganicPath(waypoints);
    this.path.setAttribute('d', pathData);

    // Setup stroke-dasharray for drawing animation
    const pathLength = this.path.getTotalLength();
    this.path.style.strokeDasharray = pathLength;
    this.path.style.strokeDashoffset = pathLength;
  }

  generateOrganicPath(waypoints) {
    if (waypoints.length < 2) return '';

    let d = `M ${waypoints[0].x} ${waypoints[0].y}`;

    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];

      // Smooth bezier curve between points
      const midY = (prev.y + curr.y) / 2;
      const tension = 0.5;

      const cp1Y = prev.y + (curr.y - prev.y) * tension;
      const cp2Y = prev.y + (curr.y - prev.y) * (1 - tension);

      d += ` C ${prev.x} ${cp1Y}, ${curr.x} ${cp2Y}, ${curr.x} ${curr.y}`;
    }

    return d;
  }

  setupScrollAnimation() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    // Animate path drawing based on scroll
    gsap.to(this.path, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: this.container,
        start: 'top center',
        end: 'bottom center',
        scrub: 1
      }
    });
  }

  setupProjectReveals() {
    // Use Intersection Observer for project reveals
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -15% 0px',
      threshold: 0.1
    });

    this.projects.forEach(project => observer.observe(project));
  }
}

// ============================================================
// LENIS SMOOTH SCROLLING
// ============================================================
function initLenis() {
  if (typeof Lenis === 'undefined') {
    console.log('Lenis not loaded');
    return;
  }

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true
  });

  // Integrate with GSAP ScrollTrigger
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  } else {
    // Fallback without GSAP
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  return lenis;
}

// PRELOADER
// ============================================================
function hidePreloader() {
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    setTimeout(() => {
      preloader.style.display = 'none';
    }, 500);
  }
}


// ============================================================
// INITIALIZE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Init Lenis first for smooth scrolling
  initLenis();

  // Visual effects
  new CursorSwitcher();
  new AuroraBackground();
  new ScrollThread();

  // Functionality
  initScrollProgress();
  initFloatingNav();
  initRevealAnimations();
  initStaggerReveal();
  initSmoothScroll();
  initTyped();
  initGSAPAnimations();

  setTimeout(hidePreloader, 300);
});

window.addEventListener('load', () => {
  initRevealAnimations();
  // Re-init scroll thread after full page load
  new ScrollThread();
});

// ============================================================
// ============================================================
// VIDEO MODAL
// ============================================================
function initVideoModal() {
  const modal = document.getElementById('video-modal');
  const iframe = document.getElementById('video-modal-iframe');
  const youtubeLink = document.getElementById('video-modal-youtube-link');
  const backdrop = modal.querySelector('.video-modal__backdrop');

  // Get all gallery items with YouTube links
  const galleryItems = document.querySelectorAll('.gallery-item[href*="youtube.com"]');

  galleryItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const youtubeUrl = item.getAttribute('href');
      const videoId = extractYouTubeId(youtubeUrl);

      if (videoId) {
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        youtubeLink.href = youtubeUrl;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  function closeModal() {
    modal.classList.remove('active');
    iframe.src = '';
    document.body.style.overflow = '';
  }

  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  function extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  }
}

// Initialize video modal
document.addEventListener('DOMContentLoaded', initVideoModal);
