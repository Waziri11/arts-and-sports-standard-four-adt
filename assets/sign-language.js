(function () {
  'use strict';

  // Keep the media revision stable while the reader receives independent fixes.
  var remoteBase = 'https://raw.githubusercontent.com/Waziri11/arts-and-sports-standard-four-adt/26cb97006f18e92b7db0d86ae36cb1827387ba65/videos/';
  // Interior files retain their immutable published source after local renumbering.
  var remoteFiles = {"page_2.mp4":"page_1.mp4","page_3.mp4":"page_2.mp4","page_4.mp4":"page_3.mp4","page_5.mp4":"page_4.mp4","page_6.mp4":"page_5.mp4","page_7.mp4":"page_6.mp4","page_8.mp4":"page_7.mp4","page_9.mp4":"page_8.mp4","page_10.mp4":"page_9.mp4","page_11.mp4":"page_10.mp4","page_12.mp4":"page_11.mp4","page_13.mp4":"page_12.mp4","page_14.mp4":"page_13.mp4","page_15.mp4":"page_14.mp4","page_16.mp4":"page_15.mp4","page_17.mp4":"page_16.mp4","page_18.mp4":"page_17.mp4","page_19.mp4":"Page_18.mp4","page_20.mp4":"Page_19.mp4","page_21.mp4":"Page_20.mp4","page_22.mp4":"Page_21.mp4","page_23.mp4":"Page_22.mp4","page_24.mp4":"Page_23.mp4","page_25.mp4":"Page_24.mp4","page_26.mp4":"Page_25.mp4","page_27.mp4":"Page_26.mp4","page_28.mp4":"Page_27.mp4","page_29.mp4":"Page_28.mp4","page_30.mp4":"Page_29.mp4","page_31.mp4":"Page_30.mp4","page_32.mp4":"Page_31.mp4","page_33.mp4":"Page_32.mp4","page_34.mp4":"Page_33.mp4","page_35.mp4":"Page_34.mp4","page_36.mp4":"Page_35.mp4","page_37.mp4":"Page_36.mp4","page_38.mp4":"Page_37.mp4","page_39.mp4":"Page_38.mp4","page_40.mp4":"Page_39.mp4","page_41.mp4":"Page_40.mp4","page_42.mp4":"Page_41.mp4","page_43.mp4":"Page_42.mp4","page_44.mp4":"Page_43.mp4","page_45.mp4":"Page_44.mp4","page_46.mp4":"page_45.mp4","page_47.mp4":"page_46.mp4","page_48.mp4":"page_47.mp4","page_49.mp4":"page_48.mp4","page_50.mp4":"page_49.mp4","page_51.mp4":"page_50.mp4","page_52.mp4":"page_51.mp4","page_53.mp4":"page_52.mp4","page_54.mp4":"page_53.mp4","page_55.mp4":"page_54.mp4","page_56.mp4":"page_55.mp4","page_57.mp4":"page_56.mp4","page_58.mp4":"page_57.mp4","page_59.mp4":"page_58.mp4","page_60.mp4":"page_59.mp4","page_61.mp4":"page_60.mp4","page_62.mp4":"page_61.mp4","page_63.mp4":"page_62.mp4","page_64.mp4":"page_63.mp4","page_65.mp4":"page_64.mp4","page_66.mp4":"page_65.mp4","page_67.mp4":"page_66.mp4","page_68.mp4":"page_67.mp4","page_69.mp4":"page_68.mp4","page_70.mp4":"page_69.mp4","page_71.mp4":"page_70.mp4","page_72.mp4":"page_71.mp4","page_73.mp4":"page_72.mp4","page_74.mp4":"page_73.mp4","page_75.mp4":"page_74.mp4","page_76.mp4":"page_75.mp4","page_77.mp4":"page_76.mp4","page_78.mp4":"page_77.mp4","page_79.mp4":"page_78.mp4","page_80.mp4":"page_79.mp4"};
  var bookBase = new URL('./', location.href);
  var localBase = new URL('videos/', bookBase).href;
  var published = location.hostname === 'waziri11.github.io';
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
    if (!match) return value;
    var filename = match[1].toLowerCase();
    return published && remoteFiles[filename]
      ? remoteBase + remoteFiles[filename] : localBase + filename;
  }

  function isSignVideo(media) {
    return media && media.tagName === 'VIDEO' &&
      (String(media.currentSrc || media.src).indexOf(localBase) === 0 ||
       String(media.currentSrc || media.src).indexOf(remoteBase) === 0);
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
