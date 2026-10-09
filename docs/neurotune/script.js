document.getElementById('year').textContent = new Date().getFullYear();

const revealElements = document.querySelectorAll('[data-reveal]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reducedMotion && 'IntersectionObserver' in window) {
    revealElements.forEach((element) => {
        const delay = Number.parseInt(element.dataset.revealDelay || '0', 10);

        element.style.setProperty('--reveal-delay', `${delay}ms`);
        element.classList.add('reveal-pending');
    });

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            const finishReveal = (event) => {
                if (event.target === entry.target && event.propertyName === 'transform') {
                    entry.target.classList.remove('reveal-pending');
                    entry.target.style.removeProperty('--reveal-delay');
                    entry.target.removeEventListener('transitionend', finishReveal);
                }
            };

            entry.target.addEventListener('transitionend', finishReveal);
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -8% 0px'
    });

    revealElements.forEach((element) => revealObserver.observe(element));
}
