// Runtime of the single-file demo (tools/build-playable.mjs inlines it into the page). The whole
// web-mobile build sits in the page as one gzip pack in base64: `#pack` holds the bytes, they start
// with a little-endian uint32 length and a JSON head: the index { path: [offset, size] } of the files
// after it and how to boot them. The loader unpacks it, then answers every request the engine makes under the page's <base>
// (scripts, XHR, fetch, images, audio, fonts) with a blob: URL of the file from the pack, and
// boots the build the way its index.html would.
//
// Plain ES5 on purpose: it runs before the engine's polyfills.
(function () {
  'use strict';
  var BASE = document.baseURI;
  var MIME = {
    js: 'text/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    webp: 'image/webp', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', ttf: 'font/ttf', bin: 'application/octet-stream',
    cconb: 'application/octet-stream', wasm: 'application/wasm',
  };
  var bytes = null;
  var index = null;
  var blobs = {};

  function fail(message, err) {
    console.error('[demo] ' + message, err || '');
    var splash = document.getElementById('splash');
    if (splash) splash.innerHTML = '<p style="color:#9ab;font:16px sans-serif;padding:24px">' + message + '</p>';
  }

  /** The pack's path of a URL the engine asks for, or null when it isn't one of the build's files. */
  function packPath(url) {
    if (!index || url === undefined || url === null) return null;
    var href;
    try {
      href = new URL(String(url), BASE).href;
    } catch (e) {
      return null;
    }
    if (href.indexOf(BASE) !== 0) return null;
    var path = href.slice(BASE.length).split('#')[0].split('?')[0];
    try {
      path = decodeURIComponent(path);
    } catch (e) {
      // Keep it as it is.
    }
    return Object.prototype.hasOwnProperty.call(index, path) ? path : null;
  }

  /** A blob: URL for a file of the pack (made once), or the URL itself. */
  function resolve(url) {
    var path = packPath(url);
    if (path === null) return url;
    var blob = blobs[path];
    if (!blob) {
      var entry = index[path];
      var ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
      blob = blobs[path] = URL.createObjectURL(new Blob([bytes.subarray(entry[0], entry[0] + entry[1])], { type: MIME[ext] || 'application/octet-stream' }));
    }
    return blob;
  }

  /** CSS with its url(...) pointed at the pack. */
  function cssUrls(css) {
    return css.replace(/url\((['"]?)([^'")]+)\1\)/g, function (all, quote, url) {
      return 'url(' + quote + resolve(url) + quote + ')';
    });
  }

  /** Points `src` of these elements (property and attribute) at the pack. */
  function patchSrc(proto) {
    var desc = Object.getOwnPropertyDescriptor(proto, 'src');
    if (!desc || !desc.set) return;
    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set: function (value) {
        desc.set.call(this, resolve(value));
      },
    });
  }

  function patch() {
    patchSrc(HTMLScriptElement.prototype);
    patchSrc(HTMLImageElement.prototype);
    patchSrc(HTMLMediaElement.prototype);
    var setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (name === 'src' && (this instanceof HTMLScriptElement || this instanceof HTMLImageElement || this instanceof HTMLMediaElement)) value = resolve(value);
      return setAttribute.call(this, name, value);
    };
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = resolve(url);
      return open.apply(this, args);
    };
    var fetch = window.fetch;
    if (fetch) {
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : input && input.url;
        var blob = resolve(url);
        return blob !== url ? fetch.call(window, blob) : fetch.call(window, input, init);
      };
    }
    // Fonts: the engine adds a <style> with an @font-face rule (or makes a FontFace) for a TTF.
    var appendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
      if (child instanceof HTMLStyleElement && child.textContent) child.textContent = cssUrls(child.textContent);
      return appendChild.call(this, child);
    };
    var Face = window.FontFace;
    if (Face) {
      var Patched = function (family, source, descriptors) {
        return new Face(family, typeof source === 'string' ? cssUrls(source) : source, descriptors);
      };
      Patched.prototype = Face.prototype;
      window.FontFace = Patched;
    }
  }

  function loadScript(path) {
    return new Promise(function (done, reject) {
      var script = document.createElement('script');
      script.onload = done;
      script.onerror = function () {
        reject(new Error('could not run ' + path));
      };
      script.src = path;
      document.body.appendChild(script);
    });
  }

  function unpack() {
    var b64 = document.getElementById('pack').textContent.replace(/\s+/g, '');
    var raw = atob(b64);
    var packed = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) packed[i] = raw.charCodeAt(i);
    var stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function (buffer) {
      var all = new Uint8Array(buffer);
      var size = all[0] | (all[1] << 8) | (all[2] << 16) | (all[3] << 24);
      var head = JSON.parse(new TextDecoder().decode(all.subarray(4, 4 + size)));
      bytes = all.subarray(4 + size);
      index = head.files;
      return head;
    });
  }

  if (typeof DecompressionStream === 'undefined' || typeof TextDecoder === 'undefined') {
    fail('This browser is too old for the demo. Play it at spaceflight.p1gog.duckdns.org');
    return;
  }
  unpack()
    .then(function (head) {
      patch();
      // The import map the build's index.html loads from src/, inline (its URLs relative to the page).
      var map = document.createElement('script');
      map.type = 'systemjs-importmap';
      map.textContent = head.importMap;
      document.head.appendChild(map);
      return loadScript(head.polyfills)
        .then(function () {
          return loadScript(head.system);
        })
        .then(function () {
          return window.System.import('./' + head.entry);
        });
    })
    .catch(function (err) {
      fail('The demo could not start.', err);
    });
})();
