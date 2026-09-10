(function () {
  'use strict';

  // Keep the media revision stable while the reader receives independent fixes.
  var remoteBase = 'https://raw.githubusercontent.com/Waziri11/arts-and-sports-standard-four-adt/26cb97006f18e92b7db0d86ae36cb1827387ba65/videos/';
  var bookBase = new URL('./', location.href);
  var videoBase = location.hostname === 'waziri11.github.io'
    ? remoteBase : new URL('videos/', bookBase).href;
  var nativePlay = HTMLMediaElement.prototype.play;
  var nativePause = HTMLMediaElement.prototype.pause;
  var nativeSetAttribute = Element.prototype.setAttribute;
  var srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  var activeAudio = null;
  var pauseTimer = null;
  var observedAudio = new WeakSet();
  var videoRetries = new WeakMap();

  function rewrite(value) {
    var url;
    try { url = new URL(String(value), bookBase); } catch (_) { return value; }
    var prefix = new URL('content/i18n/', bookBase).href;
    if (url.href.indexOf(prefix) !== 0) return value;
    var match = url.href.slice(prefix.length).match(/^en\/video\/(page_\d+\.mp4)(?:[?#].*)?$/i);
    return match ? videoBase + match[1] : value;
  }

  function isSignVideo(media) {
    return media && media.tagName === 'VIDEO' &&
      String(media.currentSrc || media.src).indexOf(videoBase) === 0;
  }

  function prepare(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    if (video.defaultPlaybackRate !== 1) video.defaultPlaybackRate = 1;
    if (video.playbackRate !== 1) video.playbackRate = 1;
  }

  // Rewrite before the runtime assigns src, including dynamically created players.
  Element.prototype.setAttribute = function (name, value) {
    if (this.tagName === 'VIDEO' && String(name).toLowerCase() === 'src') {
      var rewritten = rewrite(value);
      if (rewritten !== value) prepare(this);
      value = rewritten;
    }
    return nativeSetAttribute.call(this, name, value);
  };
  if (srcDescriptor && srcDescriptor.get && srcDescriptor.set) {
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: srcDescriptor.configurable,
      enumerable: srcDescriptor.enumerable,
      get: srcDescriptor.get,
      set: function (value) {
        var rewritten = this.tagName === 'VIDEO' ? rewrite(value) : value;
        if (rewritten !== value) prepare(this);
        srcDescriptor.set.call(this, rewritten);
      }
    });
  }

  function signVideos() {
    return Array.prototype.filter.call(document.querySelectorAll('video'), isSignVideo);
  }
  function startVideos() {
    signVideos().forEach(function (video) {
      prepare(video);
      if (!video.paused || video.ended) return;
      Promise.resolve(nativePlay.call(video)).catch(function () {
        // Native controls remain available if browser autoplay requires a click.
      });
    });
  }
  function schedulePause(audio) {
    clearTimeout(pauseTimer);
    pauseTimer = setTimeout(function () {
      if (activeAudio !== audio || (!audio.paused && !audio.ended)) return;
      activeAudio = null;
      signVideos().forEach(function (video) { nativePause.call(video); });
    }, 200);
  }
  function isNarration(audio) {
    return audio.tagName === 'AUDIO' &&
      String(audio.currentSrc || audio.src).indexOf(new URL('content/i18n/en/audio/', bookBase).href) === 0;
  }
  function followNarration(audio) {
    if (audio.paused || audio.ended) return;
    clearTimeout(pauseTimer);
    activeAudio = audio;
    startVideos();
  }

  HTMLMediaElement.prototype.play = function () {
    if (isSignVideo(this)) prepare(this);
    if (!isNarration(this)) return nativePlay.call(this);
    var audio = this;
    if (!observedAudio.has(audio)) {
      observedAudio.add(audio);
      audio.addEventListener('playing', function () { followNarration(audio); });
      audio.addEventListener('pause', function () { schedulePause(audio); });
      audio.addEventListener('ended', function () { schedulePause(audio); });
    }
    var result = nativePlay.call(audio);
    if (result && result.then) result.then(function () { followNarration(audio); }, function () {});
    return result;
  };
  HTMLMediaElement.prototype.pause = function () {
    // The compiled runtime normally makes narration and signing exclusive.
    // Ignore only its programmatic video pause while narration is playing.
    // Native video controls can still pause the player directly.
    if (isSignVideo(this) && activeAudio && !activeAudio.paused && !activeAudio.ended) return;
    return nativePause.call(this);
  };
  document.addEventListener('play', function (event) {
    if (!isSignVideo(event.target)) return;
    prepare(event.target);
    // Do not let the runtime stop narration when the sign video starts.
    // Signing also works independently, without a narration prerequisite.
    event.stopImmediatePropagation();
  }, true);
  // A transient media-server failure must not leave a permanently broken player.
  document.addEventListener('error', function (event) {
    var video = event.target;
    if (!isSignVideo(video)) return;
    var attempts = videoRetries.get(video) || 0;
    if (attempts >= 3) return;
    videoRetries.set(video, attempts + 1);
    var source = video.src;
    var resumeAt = video.currentTime || 0;
    setTimeout(function () {
      if (!video.isConnected || video.src !== source || !video.error) return;
      prepare(video);
      video.addEventListener('loadedmetadata', function () {
        if (resumeAt > 0 && resumeAt < video.duration) video.currentTime = resumeAt;
      }, { once: true });
      video.load();
      Promise.resolve(nativePlay.call(video)).catch(function () {});
    }, 1500 * Math.pow(2, attempts));
  }, true);
  ['volumechange', 'ratechange', 'loadedmetadata'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      if (isSignVideo(event.target)) prepare(event.target);
    }, true);
  });
})();
