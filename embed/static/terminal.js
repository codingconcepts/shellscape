(function () {
  'use strict';

  var SITE = window.__SITE_DATA__;
  var currentPath = window.__CURRENT_PATH__ || '/';

  var output = document.getElementById('terminal-output');
  var input = document.getElementById('terminal-input');
  var body = document.getElementById('terminal-body');
  var promptPath = document.getElementById('prompt-path');

  var history = JSON.parse(localStorage.getItem('ss_history') || '[]');
  var historyIndex = -1;
  var initialContent = output.innerHTML;

  function scrollToBottom() {
    output.scrollTop = output.scrollHeight;
  }

  function buildPageHTML(page) {
    var html = '';
    if (page.bannerHTML) {
      html += '<pre class="post-banner">' + page.bannerHTML + '</pre>';
    }
    if (page.template === 'post') {
      html += '<div class="post-header">';
      html += '<h1 class="post-header__title">' + escapeHtml(page.title) + '</h1>';
      html += '<div class="post-header__meta">';
      if (page.date) {
        html += '<span>' + escapeHtml(page.date) + '</span>';
      }
      if (page.readingTime) {
        html += '<span>' + page.readingTime + ' min read</span>';
      }
      if (page.tags && page.tags.length) {
        html += '<div class="tags">';
        for (var i = 0; i < page.tags.length; i++) {
          html += '<a href="/blog/tags/' + encodeURIComponent(page.tags[i]) + '" class="tag">#' + escapeHtml(page.tags[i]) + '</a>';
        }
        html += '</div>';
      }
      html += '</div></div>';
    }
    html += page.content;
    return html;
  }

  function updatePromptPath() {
    promptPath.textContent = '~' + currentPath;
  }

  function appendOutput(html, className) {
    var div = document.createElement('div');
    div.className = 'terminal__line' + (className ? ' terminal__line--' + className : '');
    div.innerHTML = html;
    output.appendChild(div);
    scrollToBottom();
  }

  function appendRaw(element) {
    output.appendChild(element);
    scrollToBottom();
  }

  function appendPromptEcho(cmd) {
    var prompt = SITE.terminal.prompt;
    var line = document.createElement('div');
    line.className = 'terminal__line';
    var promptHTML = '';
    if (prompt) {
      promptHTML = '<span style="color:var(--ss-prompt-user)">' + escapeHtml(prompt) +
        '</span><span style="color:var(--ss-prompt-separator)">:</span>';
    }
    line.innerHTML = promptHTML +
      '<span style="color:var(--ss-prompt-path)">~' + escapeHtml(currentPath) +
      '</span><span style="color:var(--ss-prompt-separator)">$</span> ' +
      escapeHtml(cmd);
    output.appendChild(line);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── Navigation helpers ──

  function getNavEntries(path) {
    var entries = [];

    // Add pages at this level
    var pages = SITE.pages || {};
    for (var url in pages) {
      if (!pages.hasOwnProperty(url)) continue;
      var page = pages[url];

      if (path === '/') {
        // At root: show top-level pages (excluding index)
        if (url !== '/' && url.indexOf('/', 1) === -1) {
          var hasChildren = false;
          var childPrefix = url + '/';
          for (var childUrl in pages) {
            if (pages.hasOwnProperty(childUrl) && childUrl.indexOf(childPrefix) === 0) {
              hasChildren = true;
              break;
            }
          }
          entries.push({ name: url.substring(1), type: hasChildren ? 'dir' : 'file', url: url, title: page.title });
        }
      } else if (path === '/blog') {
        // In blog: show posts
        if (url.indexOf('/blog/') === 0 && url !== '/blog') {
          var slug = url.substring(6);
          if (slug.indexOf('/') === -1) {
            entries.push({ name: slug, type: 'file', url: url, title: page.title });
          }
        }
      } else {
        // In a subpath: show children
        var prefix = path + '/';
        if (url.indexOf(prefix) === 0) {
          var rest = url.substring(prefix.length);
          if (rest.indexOf('/') === -1) {
            entries.push({ name: rest, type: 'file', url: url, title: page.title });
          }
        }
      }
    }

    // Ensure blog dir shows at root
    if (path === '/') {
      var hasBlog = false;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].name === 'blog') { hasBlog = true; break; }
      }
      var blogPosts = SITE.blog && SITE.blog.posts;
      if (!hasBlog && blogPosts && blogPosts.length > 0) {
        entries.push({ name: 'blog', type: 'dir', url: '/blog', title: 'Blog' });
      }
    }

    entries.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return entries;
  }

  function resolvePath(target) {
    if (target === '..') {
      if (currentPath === '/') return '/';
      var parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      return '/' + parts.join('/') || '/';
    }

    if (target === '~' || target === '/') return '/';

    if (target.charAt(0) === '/') return target;

    var base = currentPath === '/' ? '' : currentPath;
    return base + '/' + target;
  }

  function findPage(path) {
    return SITE.pages[path] || null;
  }

  function navigateTo(path, pushState) {
    var page = findPage(path);

    // Check if it's a valid directory-like path
    var entries = getNavEntries(path);
    if (!page && entries.length === 0 && path !== '/') {
      return false;
    }

    currentPath = path;
    updatePromptPath();
    updateActiveNav();

    if (pushState !== false) {
      window.history.pushState({ path: path }, '', path === '/' ? '/' : path);
    }

    return true;
  }

  function updateActiveNav() {
    var links = document.querySelectorAll('.terminal__nav-link');
    for (var i = 0; i < links.length; i++) {
      var linkPath = links[i].getAttribute('data-path');
      if (linkPath === currentPath || (currentPath.indexOf(linkPath) === 0 && linkPath !== '/')) {
        links[i].classList.add('terminal__nav-link--active');
      } else if (linkPath === '/' && currentPath === '/') {
        links[i].classList.add('terminal__nav-link--active');
      } else {
        links[i].classList.remove('terminal__nav-link--active');
      }
    }
  }

  // ── Commands ──

  var commands = {
    help: function () {
      var lines = [
        '<span style="color:var(--ss-accent)">Available commands:</span>',
        '',
        '  <span style="color:var(--ss-green)">ls</span> [dir]         List pages at current or given location',
        '  <span style="color:var(--ss-green)">cd</span> &lt;page&gt;       Navigate to a page',
        '  <span style="color:var(--ss-green)">cd ..</span>            Go up one level',
        '  <span style="color:var(--ss-green)">cat</span> &lt;page&gt;      Display page content',
        '  <span style="color:var(--ss-green)">open</span> &lt;page&gt;     Navigate to and display a page',
        '  <span style="color:var(--ss-green)">clear</span>            Clear the terminal',
        '  <span style="color:var(--ss-green)">history</span>          Show command history',
        '  <span style="color:var(--ss-green)">theme</span> &lt;name&gt;    Switch theme (terminal, light)',
        '',
        'You can also click any link to navigate.',
      ];
      for (var i = 0; i < lines.length; i++) {
        appendOutput(lines[i]);
      }
    },

    ls: function (args) {
      var targetPath = currentPath;
      if (args && args.length > 0) {
        targetPath = resolvePath(args[0]);
        var targetEntries = getNavEntries(targetPath);
        if (targetEntries.length === 0 && !findPage(targetPath)) {
          appendOutput('ls: cannot access \'' + escapeHtml(args[0]) + '\': No such file or directory', 'error');
          return;
        }
      }
      var entries = getNavEntries(targetPath);

      if (entries.length === 0) {
        appendOutput('(empty)', 'system');
        return;
      }

      var grid = document.createElement('div');
      grid.className = 'ls-output';

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var item = document.createElement('a');
        item.className = 'ls-item ls-item--' + entry.type;
        item.textContent = entry.name;
        item.href = entry.url;
        item.setAttribute('data-nav', entry.url);
        item.title = entry.title;
        item.setAttribute('data-type', entry.type);
        item.addEventListener('click', function (e) {
          e.preventDefault();
          var target = this.getAttribute('data-nav');
          var type = this.getAttribute('data-type');
          executeCommand((type === 'file' ? 'open ' : 'cd ') + target.split('/').pop());
        });
        grid.appendChild(item);
      }

      var maxLen = 0;
      for (var j = 0; j < entries.length; j++) {
        var nameLen = entries[j].name.length + (entries[j].type === 'dir' ? 1 : 0);
        if (nameLen > maxLen) maxLen = nameLen;
      }
      grid.style.setProperty('--ls-col-width', (maxLen + 2) + 'ch');

      appendRaw(grid);
    },

    cd: function (args) {
      if (!args || args.length === 0) {
        navigateTo('/');
        showPageContent();
        return;
      }

      var target = args[0];
      var resolved = resolvePath(target);

      if (navigateTo(resolved)) {
        showPageContent();
      } else {
        appendOutput('cd: no such directory: ' + escapeHtml(target), 'error');
      }
    },

    cat: function (args) {
      if (!args || args.length === 0) {
        appendOutput('cat: missing file operand', 'error');
        return;
      }

      var target = args[0];
      var resolved = resolvePath(target);
      var page = findPage(resolved);

      if (!page) {
        appendOutput('cat: ' + escapeHtml(target) + ': No such file', 'error');
        return;
      }

      var content = document.createElement('div');
      content.className = 'content';
      content.innerHTML = buildPageHTML(page);
      appendRaw(content);
    },

    open: function (args) {
      if (!args || args.length === 0) {
        appendOutput('open: missing file operand', 'error');
        return;
      }

      var target = args[0];
      var resolved = resolvePath(target);
      var page = findPage(resolved);

      if (!page) {
        // Try searching all pages for a slug match
        var pages = SITE.pages || {};
        for (var url in pages) {
          if (!pages.hasOwnProperty(url)) continue;
          var slug = url.split('/').pop();
          if (slug === target) {
            resolved = url;
            page = pages[url];
            break;
          }
        }
      }

      if (!page) {
        appendOutput('open: ' + escapeHtml(target) + ': No such file', 'error');
        return;
      }

      navigateTo(resolved);
      showPageContent();
    },

    clear: function () {
      output.innerHTML = '';
    },

    history: function () {
      if (history.length === 0) {
        appendOutput('(no history)', 'system');
        return;
      }
      for (var i = 0; i < history.length; i++) {
        appendOutput('  ' + (i + 1) + '  ' + escapeHtml(history[i]));
      }
    },

    theme: function (args) {
      if (!args || args.length === 0) {
        appendOutput('Usage: theme &lt;name&gt;', 'system');
        appendOutput('Available: system, light, dark', 'system');
        return;
      }

      var name = args[0];
      if (name === 'system' || name === 'light' || name === 'dark') {
        applyTheme(name);
        appendOutput('Theme switched to ' + escapeHtml(name), 'system');
      } else {
        appendOutput('theme: unknown theme: ' + escapeHtml(name), 'error');
        appendOutput('Available: system, light, dark', 'system');
      }
    }
  };

  function showPageContent() {
    var page = findPage(currentPath);
    if (page) {
      var content = document.createElement('div');
      content.className = 'content';
      content.innerHTML = buildPageHTML(page);
      output.innerHTML = '';
      output.appendChild(content);
    } else {
      output.innerHTML = '';
      commands.ls();
    }
    showWelcome();
    scrollToBottom();
  }

  function executeCommand(cmdStr) {
    var parts = cmdStr.trim().split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var args = parts.slice(1);

    appendPromptEcho(cmdStr);

    if (cmdStr.trim()) {
      history.push(cmdStr.trim());
      if (history.length > 100) history.shift();
      localStorage.setItem('ss_history', JSON.stringify(history));
    }
    historyIndex = -1;

    if (commands[cmd]) {
      commands[cmd](args);
    } else if (cmd) {
      appendOutput('command not found: ' + escapeHtml(cmd) + '. Type <span style="color:var(--ss-green)">help</span> for available commands.', 'error');
    }

    scrollToBottom();
  }

  // ── Tab completion ──

  function getCompletions(partial) {
    var entries = getNavEntries(currentPath);
    var matches = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name.indexOf(partial) === 0) {
        matches.push(entries[i].name);
      }
    }

    // Also complete command names
    var cmdNames = Object.keys(commands);
    for (var j = 0; j < cmdNames.length; j++) {
      if (cmdNames[j].indexOf(partial) === 0) {
        matches.push(cmdNames[j]);
      }
    }

    return matches;
  }

  // ── Input handling ──

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var cmd = input.value;
      input.value = '';
      if (cmd.trim()) {
        executeCommand(cmd);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndex === -1) {
        historyIndex = history.length - 1;
      } else if (historyIndex > 0) {
        historyIndex--;
      }
      input.value = history[historyIndex];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      } else {
        historyIndex = -1;
        input.value = '';
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      var val = input.value;
      var parts = val.split(/\s+/);
      var last = parts[parts.length - 1];

      if (last) {
        var completions = getCompletions(last);
        if (completions.length === 1) {
          parts[parts.length - 1] = completions[0];
          input.value = parts.join(' ');
        } else if (completions.length > 1) {
          appendPromptEcho(val);
          appendOutput(completions.join('  '), 'system');
        }
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      commands.clear();
    }
  });

  // Focus input on click anywhere in terminal body
  body.addEventListener('click', function (e) {
    if (e.target.tagName !== 'A' && e.target.tagName !== 'INPUT') {
      input.focus();
    }
  });

  // ── Nav link clicks ──

  document.addEventListener('click', function (e) {
    var link = e.target.closest('.terminal__nav-link');
    if (link) {
      e.preventDefault();
      var path = link.getAttribute('data-path');
      if (navigateTo(path)) {
        showPageContent();
      }
    }

    // Handle content links with data-nav
    var navLink = e.target.closest('[data-nav]');
    if (navLink) {
      e.preventDefault();
      var navPath = navLink.getAttribute('data-nav');
      if (navigateTo(navPath)) {
        showPageContent();
      }
    }
  });

  // ── Browser back/forward ──

  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.path) {
      currentPath = e.state.path;
      updatePromptPath();
      updateActiveNav();
      showPageContent();
    }
  });

  // ── ASCII art welcome on home page ──

  function showWelcome() {
    if (currentPath !== '/') return;

    var bannerHTML = SITE.terminal.bannerHTML;
    var art = SITE.terminal.asciiArt;
    if (!bannerHTML && !art) return;

    var container = document.createElement('div');

    if (bannerHTML) {
      var banner = document.createElement('div');
      banner.className = 'banner';
      banner.innerHTML = bannerHTML;
      container.appendChild(banner);
    } else {
      var lines = art.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = document.createElement('div');
        line.className = 'terminal__line terminal__line--ascii';
        line.textContent = lines[i];
        container.appendChild(line);
      }
    }

    var spacer = document.createElement('div');
    spacer.className = 'terminal__line';
    spacer.innerHTML = '&nbsp;';
    container.appendChild(spacer);

    var hint = document.createElement('div');
    hint.className = 'terminal__line terminal__line--system';
    hint.textContent = 'Type help for available commands, or click around to navigate.';
    container.appendChild(hint);

    var spacer2 = document.createElement('div');
    spacer2.className = 'terminal__line';
    spacer2.innerHTML = '&nbsp;';
    container.appendChild(spacer2);

    // Insert before existing content
    output.insertBefore(container, output.firstChild);
    scrollToBottom();
  }

  // ── Init ──

  // ── Theme toggle ──

  var themeCache = {};
  var darkMedia = window.matchMedia('(prefers-color-scheme: dark)');

  function applyThemeCSS(name) {
    if (themeCache[name]) {
      setThemeStyle(themeCache[name]);
      return;
    }
    fetch('/' + name + '-theme.css')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (css) {
        if (css) {
          themeCache[name] = css;
          setThemeStyle(css);
        }
      });
  }

  function setThemeStyle(css) {
    var early = document.getElementById('ss-theme-early');
    if (early) early.remove();

    var style = document.getElementById('ss-theme-override');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ss-theme-override';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function applyTheme(mode) {
    localStorage.setItem('ss_theme', mode);
    var isLight;
    if (mode === 'system') {
      isLight = !darkMedia.matches;
      applyThemeCSS(isLight ? 'light' : 'terminal');
    } else if (mode === 'light') {
      isLight = true;
      applyThemeCSS('light');
    } else {
      isLight = false;
      applyThemeCSS('terminal');
    }
    document.documentElement.setAttribute('data-code-theme', isLight ? 'light' : 'dark');
    var btns = document.querySelectorAll('.theme-toggle__btn');
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      if (btn.getAttribute('data-theme') === mode) {
        btn.classList.add('theme-toggle__btn--active');
      } else {
        btn.classList.remove('theme-toggle__btn--active');
      }
    }
  }

  var toggleEl = document.getElementById('theme-toggle');
  if (toggleEl) {
    toggleEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.theme-toggle__btn');
      if (btn) applyTheme(btn.getAttribute('data-theme'));
    });
  }

  darkMedia.addEventListener('change', function () {
    if ((localStorage.getItem('ss_theme') || 'system') === 'system') {
      applyThemeCSS(darkMedia.matches ? 'terminal' : 'light');
      document.documentElement.setAttribute('data-code-theme', darkMedia.matches ? 'dark' : 'light');
    }
  });

  var savedTheme = localStorage.getItem('ss_theme') || 'system';
  applyTheme(savedTheme);

  // ── Init ──

  window.history.replaceState({ path: currentPath }, '', window.location.pathname);
  updateActiveNav();
  showWelcome();
  input.focus();

  // ── Live reload (dev only) ──

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    var es = new EventSource('/_reload');
    es.onmessage = function () { location.reload(); };
    es.onerror = function () { setTimeout(function () { es.close(); }, 5000); };
  }
})();
