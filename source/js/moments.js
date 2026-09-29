(() => {
  'use strict';
  const dialog = document.getElementById('moments-lightbox');
  if (!dialog || !dialog.showModal) return;
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('p');
  document.getElementById('moments-feed')?.addEventListener('click', event => {
    const link = event.target.closest('[data-image-src]');
    if (!link) return;
    event.preventDefault();
    image.src = link.dataset.imageSrc;
    image.alt = link.dataset.imageAlt;
    caption.textContent = link.dataset.imageAlt;
    dialog.showModal();
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { image.removeAttribute('src'); });
})();
