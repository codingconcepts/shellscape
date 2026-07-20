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
  var findIndex = null;
  var suppressScroll = false;

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
          html += '<a href="/' + SITE.postsDir + '/tags/' + encodeURIComponent(page.tags[i]) + '" class="tag">#' + escapeHtml(page.tags[i]) + '</a>';
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
      } else if (path === '/' + SITE.postsDir) {
        var postsPrefix = '/' + SITE.postsDir + '/';
        if (url.indexOf(postsPrefix) === 0 && url !== '/' + SITE.postsDir) {
          var slug = url.substring(postsPrefix.length);
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

    // Ensure posts dir shows at root
    if (path === '/') {
      var postsDir = SITE.postsDir;
      var hasPostsDir = false;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].name === postsDir) { hasPostsDir = true; break; }
      }
      var blogPosts = SITE.blog && SITE.blog.posts;
      if (!hasPostsDir && blogPosts && blogPosts.length > 0) {
        entries.push({ name: postsDir, type: 'dir', url: '/' + postsDir, title: postsDir.charAt(0).toUpperCase() + postsDir.slice(1) });
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

    if (target === '.') return currentPath;

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

    var isDir = !page || entries.length > 0;
    if (isDir) {
      currentPath = path;
    } else {
      var parts = path.split('/').filter(Boolean);
      parts.pop();
      currentPath = parts.length ? '/' + parts.join('/') : '/';
    }
    updatePromptPath();
    updateActiveNav();

    if (pushState !== false) {
      window.history.pushState({ path: path }, '', path === '/' ? '/' : path);
    }

    return path;
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
        '  <span style="color:var(--ss-green)">ls</span> [dir]       List pages at current or given location',
        '  <span style="color:var(--ss-green)">cd</span> &lt;page&gt;      Navigate to a page',
        '  <span style="color:var(--ss-green)">open</span> &lt;page&gt;    Navigate to and display a page',
        '  <span style="color:var(--ss-green)">find</span> &lt;query&gt;   Search pages by title, path, or content',
        '  <span style="color:var(--ss-green)">tree</span> [dir]     Show site hierarchy',
        '  <span style="color:var(--ss-green)">pwd</span>            Print current path',
        '  <span style="color:var(--ss-green)">whoami</span>         Display site author info',
        '  <span style="color:var(--ss-green)">date</span>           Show current date and time',
        '  <span style="color:var(--ss-green)">clear</span>          Clear the terminal',
        '  <span style="color:var(--ss-green)">history</span>        Show command history',
        '  <span style="color:var(--ss-green)">theme</span> &lt;name&gt;   Switch theme (system, light, dark)',
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
        var p = navigateTo('/');
        showPageContent(p);
        return;
      }

      var target = args[0];
      var resolved = resolvePath(target);

      var p = navigateTo(resolved);
      if (p) {
        showPageContent(p);
      } else {
        appendOutput('cd: no such directory: ' + escapeHtml(target), 'error');
      }
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

      var p = navigateTo(resolved);
      showPageContent(p);
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
    },

    pwd: function () {
      appendOutput('~' + currentPath);
    },

    date: function () {
      appendOutput(new Date().toString());
    },

    whoami: function () {
      var info = SITE.terminal.whoami;
      if (info) {
        appendOutput(info);
      } else {
        appendOutput('whoami: not configured', 'system');
      }
    },

    find: function (args) {
      var query = (args && args.length > 0) ? args.join(' ').toLowerCase() : '';
      if (!query) {
        appendOutput('Usage: find &lt;query&gt;', 'system');
        return;
      }

      function doSearch(index) {
        var titleHits = [];
        var contentHits = [];
        for (var url in index) {
          if (!index.hasOwnProperty(url)) continue;
          var entry = index[url];
          var title = (entry.title || '').toLowerCase();
          var content = entry.content || '';
          if (title.indexOf(query) !== -1 || url.toLowerCase().indexOf(query) !== -1) {
            titleHits.push(entry);
          } else if (content.indexOf(query) !== -1) {
            var idx = content.indexOf(query);
            var start = Math.max(0, idx - 40);
            var end = Math.min(content.length, idx + query.length + 40);
            var snippet = (start > 0 ? '...' : '') +
              content.substring(start, end) +
              (end < content.length ? '...' : '');
            contentHits.push({ url: entry.url, title: entry.title, snippet: snippet });
          }
        }

        if (titleHits.length === 0 && contentHits.length === 0) {
          appendOutput('No results for \'' + escapeHtml(args.join(' ')) + '\'', 'system');
          return;
        }

        for (var i = 0; i < titleHits.length; i++) {
          var r = titleHits[i];
          var link = '<a href="' + r.url + '" data-nav="' + r.url + '" style="color:var(--ss-green);cursor:pointer">' + escapeHtml(r.url) + '</a>';
          appendOutput('  ' + link + '  ' + escapeHtml(r.title));
        }
        for (var j = 0; j < contentHits.length; j++) {
          var c = contentHits[j];
          var cLink = '<a href="' + c.url + '" data-nav="' + c.url + '" style="color:var(--ss-green);cursor:pointer">' + escapeHtml(c.url) + '</a>';
          appendOutput('  ' + cLink + '  ' + escapeHtml(c.title));
          appendOutput('    <span style="color:var(--ss-dim)">' + escapeHtml(c.snippet) + '</span>');
        }
      }

      if (findIndex) {
        doSearch(findIndex);
      } else {
        fetch('/find.json')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            findIndex = data;
            doSearch(data);
          })
          .catch(function () {
            appendOutput('find: failed to load search index', 'error');
          });
      }
    },

    tree: function (args) {
      var root = currentPath;
      if (args && args.length > 0) {
        root = resolvePath(args[0]);
        var entries = getNavEntries(root);
        if (entries.length === 0 && !findPage(root)) {
          appendOutput('tree: \'' + escapeHtml(args[0]) + '\': No such directory', 'error');
          return;
        }
      }

      function buildTree(path, prefix) {
        var entries = getNavEntries(path);
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var isLast = i === entries.length - 1;
          var connector = isLast ? '└── ' : '├── ';
          var color = entry.type === 'dir' ? 'var(--ss-blue)' : 'var(--ss-green)';
          var display = entry.type === 'dir' ? entry.name + '/' : entry.name;
          appendOutput(prefix + connector + '<span style="color:' + color + '">' + escapeHtml(display) + '</span>');
          if (entry.type === 'dir') {
            var childPrefix = prefix + (isLast ? '    ' : '│   ');
            buildTree(entry.url, childPrefix);
          }
        }
      }

      appendOutput('<span style="color:var(--ss-blue)">.</span>');
      buildTree(root, '');
    }
  };

  function showPageContent(pagePath) {
    var resolvedPath = pagePath || currentPath;
    var page = findPage(resolvedPath);
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
    if (resolvedPath === '/') showWelcome();
    output.scrollTop = 0;
    suppressScroll = true;
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

    if (suppressScroll) {
      suppressScroll = false;
    } else {
      scrollToBottom();
    }
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

  // Focus input on "/" key press
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      if (document.activeElement) document.activeElement.blur();
      input.focus();
      input.scrollIntoView({ block: 'nearest' });
    }
  });

  // ── Nav link clicks ──

  document.addEventListener('click', function (e) {
    var link = e.target.closest('.terminal__nav-link');
    if (link) {
      e.preventDefault();
      var path = link.getAttribute('data-path');
      var p = navigateTo(path);
      if (p) {
        showPageContent(p);
      }
    }

    // Handle content links with data-nav
    var navLink = e.target.closest('[data-nav]');
    if (navLink) {
      e.preventDefault();
      var navPath = navLink.getAttribute('data-nav');
      var p = navigateTo(navPath);
      if (p) {
        showPageContent(p);
      }
    }
  });

  // ── Browser back/forward ──

  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.path) {
      var p = navigateTo(e.state.path, false);
      if (p) showPageContent(p);
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
