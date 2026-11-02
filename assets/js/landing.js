/* Scroll scenes for the home page. Without GSAP, or with reduced motion
   turned on, the page stays as a plain stacked layout. */
(() => {
  const { gsap, ScrollTrigger } = window;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!gsap || !ScrollTrigger || reduceMotion) return;

  document.documentElement.classList.add('lp-motion');
  gsap.registerPlugin(ScrollTrigger);

  /* Scene 1: the intro shrinks and fades as you scroll away */
  gsap
    .timeline({
      scrollTrigger: { trigger: '.lp-intro', start: 'top top', end: 'bottom top', scrub: true }
    })
    .to('.lp-intro-inner', { scale: 0.86, y: -80, opacity: 0, ease: 'none' })
    .to('.lp-scroll-cue', { opacity: 0, ease: 'none' }, 0);

  /* Scene 2: HF Scoring, pinned while the phone walks through the app */
  const hf = document.querySelector('.lp-hf');

  if (hf) {
    const steps = gsap.utils.toArray('.lp-step');
    const shots = gsap.utils.toArray('.lp-shot');
    const number = document.querySelector('.lp-hf-number');
    const value = document.querySelector('.lp-hf-number-value');
    const target = parseFloat(value.textContent) || 0;
    const counter = { v: 0 };

    gsap.set(steps[0], { opacity: 1 });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: {
        trigger: hf,
        start: 'top top',
        end: () => `+=${window.innerHeight * steps.length}`,
        scrub: 0.6,
        pin: true,
        anticipatePin: 1
      }
    });

    /* the phone rises into place while the first caption fades up */
    tl.from('.lp-phone', { y: '35vh', rotateX: 28, scale: 0.82, opacity: 0, duration: 1 }).from(
      steps[0],
      { y: 40, opacity: 0, duration: 0.8 },
      '<0.2'
    );

    steps.slice(1).forEach((step, i) => {
      const at = `step${i + 1}`;
      tl.addLabel(at, '+=0.6')
        .to(steps[i], { y: -30, opacity: 0, duration: 0.5 }, at)
        .fromTo(step, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, `${at}+=0.3`);

      if (shots[i + 1]) {
        tl.to(shots[i + 1], { opacity: 1, duration: 0.5 }, `${at}+=0.15`);
      }

      /* the hit factor step: the number pops out next to the phone and counts up */
      if (i + 1 === 2 && number) {
        tl.fromTo(
          number,
          { opacity: 0, x: 30, scale: 0.9 },
          { opacity: 1, x: 0, scale: 1, duration: 0.5 },
          `${at}+=0.4`
        ).to(
          counter,
          {
            v: target,
            duration: 0.8,
            ease: 'power1.out',
            onUpdate: () => {
              value.textContent = counter.v.toFixed(4);
            }
          },
          '<'
        );
      }

      if (i + 1 === 3 && number) {
        tl.to(number, { opacity: 0, x: 20, duration: 0.4 }, at);
      }
    });

    /* hold on the last step for a moment before the pin releases */
    tl.to({}, { duration: 0.6 });
  }

  /* Everything else fades up as it comes into view */
  ScrollTrigger.batch('.lp-reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (els) =>
      gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 })
  });
})();
