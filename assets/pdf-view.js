(function () {
  function initializePdfView() {
    var layer = document.querySelector('.pdf-html-layer');
    var facsimile = document.querySelector('.pdf-facsimile-shell');
    var image = document.querySelector('.pdf-facsimile-page');
    var toggle = document.querySelector('.pdf-view-toggle');

    if (!layer || !facsimile || !image || !toggle) return;

    var semanticSection = layer.querySelector('[data-section-type]');
    var sectionType = semanticSection ? semanticSection.getAttribute('data-section-type') || '' : '';
    var isActivity = sectionType.indexOf('activity_') === 0 || !!layer.querySelector('[data-activity-item]');
    var htmlLabel = isActivity ? 'Open interactive activity' : 'Show accessible HTML';

    function setMode(showHtml) {
      document.body.classList.toggle('pdf-html-mode', showHtml);
      layer.setAttribute('aria-hidden', showHtml ? 'false' : 'true');
      if (showHtml) layer.removeAttribute('inert');
      else layer.setAttribute('inert', '');
      toggle.setAttribute('aria-pressed', showHtml ? 'true' : 'false');
      toggle.textContent = showHtml ? 'Show PDF view' : htmlLabel;
    }

    toggle.addEventListener('click', function () {
      setMode(!document.body.classList.contains('pdf-html-mode'));
    });

    image.addEventListener('error', function () {
      setMode(true);
      toggle.textContent = 'PDF image unavailable - HTML shown';
    }, { once: true });

    setMode(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePdfView, { once: true });
  } else {
    initializePdfView();
  }
})();
