(function () {
  function initializePdfView() {
    var layer = document.querySelector('.pdf-html-layer');
    var facsimile = document.querySelector('.pdf-facsimile-shell');
    var toggle = document.querySelector('.pdf-view-toggle');

    if (!layer) return;

    // This public link is the Accessible Digital Textbook only. Remove the
    // source-page facsimile and its view switch so readers always remain in
    // the semantic, interactive ADT experience.
    if (facsimile) facsimile.remove();
    if (toggle) toggle.remove();
    document.body.classList.add('pdf-html-mode');
    layer.setAttribute('aria-hidden', 'false');
    layer.removeAttribute('inert');

    // Source watermarks are publishing artifacts, not book content. They used to
    // be exposed to the read-aloud system and were therefore announced between
    // paragraphs. Keep the source facsimile available as an optional reference,
    // but remove these artifacts from the accessible reading layer.
    Array.prototype.forEach.call(layer.querySelectorAll('*'), function (element) {
      if ((element.textContent || '').trim().toUpperCase() === 'FOR ONLINE READING ONLY') {
        element.removeAttribute('data-id');
        element.setAttribute('aria-hidden', 'true');
        element.hidden = true;
      }
    });

    // Banner artwork is decorative when the same Activity/Think/Introduction
    // label is already present as real text. Excluding it prevents duplicated
    // announcements while keeping the visible icon in place.
    Array.prototype.forEach.call(layer.querySelectorAll('img[data-id]'), function (image) {
      var label = (image.getAttribute('alt') || '').trim();
      if (/^(?:activity\s+\d+\b|think\b|introduction\b)/i.test(label)) {
        image.removeAttribute('data-id');
        image.setAttribute('alt', '');
        image.setAttribute('role', 'presentation');
        image.setAttribute('aria-hidden', 'true');
      }
    });

    function removeLateArtifacts() {
      Array.prototype.forEach.call(layer.querySelectorAll('img[data-id]'), function (image) {
        var label = (image.getAttribute('alt') || '').trim();
        if (/^(?:activity\s+\d+\b|think\b|introduction\b)/i.test(label)) {
          image.removeAttribute('data-id');
          image.setAttribute('alt', '');
          image.setAttribute('role', 'presentation');
          image.setAttribute('aria-hidden', 'true');
        }
      });
      Array.prototype.forEach.call(document.querySelectorAll('button'), function (button) {
        if ((button.textContent || '').trim().toLowerCase() === 'submit') {
          button.hidden = true;
          button.setAttribute('aria-hidden', 'true');
          button.setAttribute('tabindex', '-1');
        }
      });
    }
    removeLateArtifacts();
    new MutationObserver(removeLateArtifacts).observe(document.body, { childList: true, subtree: true });

    // The last words of page 7 were duplicated at the top of page 8 in the
    // source conversion. Keep them with their sentence on page 7 only.
    var duplicatedContinuation = layer.querySelector('[data-id="pg014_n0002"]');
    if (duplicatedContinuation) {
      duplicatedContinuation.removeAttribute('data-id');
      duplicatedContinuation.hidden = true;
      duplicatedContinuation.setAttribute('aria-hidden', 'true');
    }
    var correctedContinuation = layer.querySelector('[data-id="pg013_n0029"]');
    if (correctedContinuation) {
      var continuationText = 'Laughing and crying are normal emotions, but they can be challenging to portray realistically in acting.';
      var applyContinuationFix = function () {
        if (correctedContinuation.textContent !== continuationText) correctedContinuation.textContent = continuationText;
      };
      applyContinuationFix();
      new MutationObserver(applyContinuationFix).observe(correctedContinuation, { childList: true, characterData: true, subtree: true });
    }

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePdfView, { once: true });
  } else {
    initializePdfView();
  }
})();
