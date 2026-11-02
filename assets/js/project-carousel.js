/* Photo carousels on the Projects cards. Swiping and scrolling work without
   this script (CSS scroll-snap); it adds the arrow buttons and the dots. */
(() => {
  document.querySelectorAll('[data-project-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.project-carousel-track');
    const dots = [...carousel.querySelectorAll('.project-carousel-dots span')];
    const prev = carousel.querySelector('.is-prev');
    const next = carousel.querySelector('.is-next');

    if (!track || !dots.length) return;

    const count = dots.length;
    const current = () => Math.round(track.scrollLeft / track.clientWidth);
    const go = (i) => track.scrollTo({ left: ((i + count) % count) * track.clientWidth, behavior: 'smooth' });

    prev.addEventListener('click', () => go(current() - 1));
    next.addEventListener('click', () => go(current() + 1));

    const slides = [...track.children];

    track.addEventListener(
      'scroll',
      () => {
        const i = current();
        dots.forEach((dot, j) => dot.classList.toggle('is-active', j === i));
        // stop a video once it's swiped out of view
        slides.forEach((slide, j) => {
          const video = slide.querySelector('video');
          if (video && j !== i && !video.paused) video.pause();
        });
      },
      { passive: true }
    );
  });
})();
