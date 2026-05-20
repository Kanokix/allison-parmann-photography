// Mobile nav toggle
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      navLinks.classList.remove('open');
    });
  });
}

// Navbar scroll effect
const navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// Scroll reveal
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

revealElements.forEach(el => revealObserver.observe(el));

// Portfolio filter
const filterBtns = document.querySelectorAll('.filter-btn');
const galleryItems = document.querySelectorAll('.gallery-item');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;

    galleryItems.forEach(item => {
      if (filter === 'all' || item.dataset.category === filter) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  });
});

// Lightbox
const lightbox = document.querySelector('.lightbox');
const lightboxImg = document.querySelector('.lightbox img');
const lightboxClose = document.querySelector('.lightbox-close');
const lightboxPrev = document.querySelector('.lightbox-prev');
const lightboxNext = document.querySelector('.lightbox-next');
let currentIndex = 0;
let visibleItems = [];

function openLightbox(index) {
  visibleItems = Array.from(galleryItems).filter(item => item.style.display !== 'none');
  currentIndex = visibleItems.indexOf(galleryItems[index]);
  if (currentIndex === -1) currentIndex = 0;
  lightboxImg.src = visibleItems[currentIndex].querySelector('img').src;
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

function navigate(direction) {
  visibleItems = Array.from(galleryItems).filter(item => item.style.display !== 'none');
  currentIndex = (currentIndex + direction + visibleItems.length) % visibleItems.length;
  lightboxImg.src = visibleItems[currentIndex].querySelector('img').src;
}

galleryItems.forEach((item, index) => {
  item.addEventListener('click', () => openLightbox(index));
});

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxPrev) lightboxPrev.addEventListener('click', () => navigate(-1));
if (lightboxNext) lightboxNext.addEventListener('click', () => navigate(1));

if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

document.addEventListener('keydown', (e) => {
  if (!lightbox || !lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') navigate(-1);
  if (e.key === 'ArrowRight') navigate(1);
});

// Contact form handler - sends to backend
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.submit-btn');
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.querySelector('#name').value,
          email: contactForm.querySelector('#email').value,
          subject: contactForm.querySelector('#subject').value,
          message: contactForm.querySelector('#message').value
        })
      });

      if (res.ok) {
        btn.textContent = 'Sent!';
        contactForm.reset();
        setTimeout(() => {
          btn.textContent = 'Send Message';
          btn.disabled = false;
        }, 3000);
      } else {
        throw new Error();
      }
    } catch {
      btn.textContent = 'Send Message';
      btn.disabled = false;
      alert('Something went wrong. Please email me directly at allisonparmann@gmail.com');
    }
  });
}

// Dynamic portfolio loading
const galleryGrid = document.querySelector('.gallery-grid');
if (galleryGrid && document.querySelector('.filter-bar')) {
  fetch('/api/gallery')
    .then(res => res.json())
    .then(images => {
      galleryGrid.innerHTML = images.map(img => `
        <div class="gallery-item" data-category="${img.category}">
          <img src="/${img.file}" alt="${img.title}" loading="lazy">
          <div class="img-overlay">
            <div>
              <div class="img-title">${img.title}</div>
              <div class="img-category">${img.category.charAt(0).toUpperCase() + img.category.slice(1)}</div>
            </div>
          </div>
        </div>
      `).join('');

      // Re-bind lightbox and filter to new dynamic items
      const newItems = galleryGrid.querySelectorAll('.gallery-item');

      newItems.forEach((item, index) => {
        item.addEventListener('click', () => {
          const vis = Array.from(newItems).filter(i => i.style.display !== 'none');
          const idx = vis.indexOf(item);
          if (lightbox && lightboxImg) {
            lightboxImg.src = vis[idx].querySelector('img').src;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Override navigate for dynamic items
            let ci = idx;
            const navDyn = (dir) => {
              ci = (ci + dir + vis.length) % vis.length;
              lightboxImg.src = vis[ci].querySelector('img').src;
            };

            if (lightboxPrev) lightboxPrev.onclick = () => navDyn(-1);
            if (lightboxNext) lightboxNext.onclick = () => navDyn(1);
          }
        });
      });

      // Re-bind filters
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.filter;
          newItems.forEach(item => {
            item.style.display = (filter === 'all' || item.dataset.category === filter) ? 'block' : 'none';
          });
        });
      });
    })
    .catch(() => {}); // fallback: keep static HTML
}
