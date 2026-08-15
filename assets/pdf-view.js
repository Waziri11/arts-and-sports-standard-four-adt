(function () {
  // Enable meaningful image descriptions for every reader once. The runtime's
  // built-in fallback is off, which leaves valid image-description audio out
  // of the read-aloud queue. The migration marker preserves the user's choice
  // if they later switch image descriptions off in Accessibility settings.
  try {
    if (window.localStorage.getItem('describeImagesDefaultVersion') !== '2') {
      window.localStorage.setItem('describeImagesMode', 'true');
      window.localStorage.setItem('describeImagesDefaultVersion', '2');
      var cookiePath = window.location.pathname.slice(0, window.location.pathname.lastIndexOf('/') + 1) || '/';
      document.cookie = 'describeImagesMode=true; max-age=31536000; path=' + cookiePath;
      document.cookie = 'describeImagesDefaultVersion=2; max-age=31536000; path=' + cookiePath;
    }
  } catch (_) {
    // Storage can be unavailable in privacy-restricted contexts. The reader
    // still loads normally and the setting remains available in its UI.
  }

  function initializePdfView() {
    var layer = document.querySelector('.pdf-html-layer');

    if (!layer) return;

    // The public reader contains only the semantic, interactive ADT layer.
    document.body.classList.add('pdf-html-mode');
    layer.setAttribute('aria-hidden', 'false');
    layer.removeAttribute('inert');

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

    function markImageDecorative(image) {
      image.removeAttribute('data-id');
      image.setAttribute('alt', '');
      image.setAttribute('role', 'presentation');
      image.setAttribute('aria-hidden', 'true');
    }

    function removeActivityHeaderArtwork() {
      Array.prototype.forEach.call(layer.querySelectorAll('[data-id]'), function (title) {
        if (!/^activity\s+\d+$/i.test((title.textContent || '').trim())) return;
        var scope = title.parentElement;
        for (var depth = 0; scope && scope !== layer && depth < 4; depth += 1, scope = scope.parentElement) {
          var images = scope.querySelectorAll('img');
          if (!images.length) continue;
          Array.prototype.forEach.call(images, markImageDecorative);
          break;
        }
      });
    }

    function removeLateArtifacts() {
      Array.prototype.forEach.call(layer.querySelectorAll('img[data-id]'), function (image) {
        var label = (image.getAttribute('alt') || '').trim();
        if (/^(?:activity\s+\d+\b|think\b|introduction\b)/i.test(label)) {
          markImageDecorative(image);
        }
      });
      removeActivityHeaderArtwork();
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

    // Confirmed Roman-number sequences must be announced as numbers rather
    // than as isolated letters by assistive technology. The alphabetic (i)
    // entry on page 70 is intentionally excluded.
    var romanNumberIds = new Set([
      'pg029_n0007', 'pg029_n0011', 'pg029_n0016', 'pg029_n0020', 'pg029_n0025', 'pg029_n0031', 'pg029_n0037',
      'pg031_n0022', 'pg031_n0025', 'pg032_n0003', 'pg032_n0006',
      'pg033_n0003', 'pg033_n0009', 'pg033_n0015', 'pg033_n0021', 'pg033_n0027', 'pg033_n0033',
      'pg037_n0003', 'pg037_n0006', 'pg037_n0009', 'pg037_n0012', 'pg037_n0015',
      'pg037_n0021', 'pg037_n0024', 'pg037_n0027', 'pg037_n0033',
      'pg038_n0002', 'pg038_n0006', 'pg038_n0007', 'pg041_n0007',
      'pg077_n0006', 'pg077_n0007', 'pg077_n0014', 'pg077_n0021', 'pg077_n0028',
      'pg078_n0002', 'pg078_n0009', 'pg078_n0017', 'pg078_n0026', 'pg078_n0031', 'pg078_n0036', 'pg078_n0041',
      'pg080_n0016', 'pg080_n0022', 'pg080_n0028'
    ]);
    var romanWords = { i: 'one', ii: 'two', iii: 'three', iv: 'four', v: 'five', vi: 'six', vii: 'seven', viii: 'eight', ix: 'nine', x: 'ten' };
    var romanToken = /\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)/gi;
    var romanRange = /\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)\s*(?:to|[-–—])\s*\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)/gi;
    Array.prototype.forEach.call(layer.querySelectorAll('[data-id]'), function (element) {
      var id = element.getAttribute('data-id');
      if (!romanNumberIds.has(id)) return;
      var spokenLabel = (element.textContent || '').trim()
        .replace(romanRange, function (_, from, to) { return 'Roman numbers ' + romanWords[from.toLowerCase()] + ' to ' + romanWords[to.toLowerCase()]; })
        .replace(romanToken, function (_, numeral) { return 'Roman number ' + romanWords[numeral.toLowerCase()]; });
      if (spokenLabel) element.setAttribute('aria-label', spokenLabel);
    });

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePdfView, { once: true });
  } else {
    initializePdfView();
  }
})();
