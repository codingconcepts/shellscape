(() => {
  // embed/static/src/terminal-core.js
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function resolvePath(currentPath, target) {
    if (target === "..") {
      if (currentPath === "/") return "/";
      var parts = currentPath.split("/").filter(Boolean);
      parts.pop();
      return "/" + parts.join("/") || "/";
    }
    if (target === ".") return currentPath;
    if (target === "~" || target === "/") return "/";
    if (target.charAt(0) === "/") return target;
    var base = currentPath === "/" ? "" : currentPath;
    return base + "/" + target;
  }
  function findPage(pages, path) {
    return pages[path] || null;
  }
  function getNavEntries(site, path) {
    var entries = [];
    var pages = site.pages || {};
    for (var url in pages) {
      if (!pages.hasOwnProperty(url)) continue;
      var page = pages[url];
      if (path === "/") {
        if (url !== "/" && url.indexOf("/", 1) === -1) {
          var hasChildren = false;
          var childPrefix = url + "/";
          for (var childUrl in pages) {
            if (pages.hasOwnProperty(childUrl) && childUrl.indexOf(childPrefix) === 0) {
              hasChildren = true;
              break;
            }
          }
          entries.push({ name: url.substring(1), type: hasChildren ? "dir" : "file", url, title: page.title });
        }
      } else if (path === "/" + site.postsDir) {
        var postsPrefix = "/" + site.postsDir + "/";
        if (url.indexOf(postsPrefix) === 0 && url !== "/" + site.postsDir) {
          var slug = url.substring(postsPrefix.length);
          if (slug.indexOf("/") === -1) {
            entries.push({ name: slug, type: "file", url, title: page.title });
          }
        }
      } else {
        var prefix = path + "/";
        if (url.indexOf(prefix) === 0) {
          var rest = url.substring(prefix.length);
          if (rest.indexOf("/") === -1) {
            entries.push({ name: rest, type: "file", url, title: page.title });
          }
        }
      }
    }
    if (path === "/") {
      var postsDir = site.postsDir;
      var hasPostsDir = false;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].name === postsDir) {
          hasPostsDir = true;
          break;
        }
      }
      var blogPosts = site.blog && site.blog.posts;
      if (!hasPostsDir && blogPosts && blogPosts.length > 0) {
        entries.push({ name: postsDir, type: "dir", url: "/" + postsDir, title: postsDir.charAt(0).toUpperCase() + postsDir.slice(1) });
      }
    }
    entries.sort(function(a, b) {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return entries;
  }
  function getCompletions(entries, commandNames, partial) {
    var matches = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name.indexOf(partial) === 0) {
        matches.push(entries[i].name);
      }
    }
    for (var j = 0; j < commandNames.length; j++) {
      if (commandNames[j].indexOf(partial) === 0) {
        matches.push(commandNames[j]);
      }
    }
    return matches;
  }
  function searchIndex(index, query) {
    var titleHits = [];
    var contentHits = [];
    var lowerQuery = query.toLowerCase();
    for (var url in index) {
      if (!index.hasOwnProperty(url)) continue;
      var entry = index[url];
      var title = (entry.title || "").toLowerCase();
      var content = entry.content || "";
      if (title.indexOf(lowerQuery) !== -1 || url.toLowerCase().indexOf(lowerQuery) !== -1) {
        titleHits.push(entry);
      } else if (content.indexOf(lowerQuery) !== -1) {
        var idx = content.indexOf(lowerQuery);
        var start = Math.max(0, idx - 40);
        var end = Math.min(content.length, idx + lowerQuery.length + 40);
        var snippet = (start > 0 ? "..." : "") + content.substring(start, end) + (end < content.length ? "..." : "");
        contentHits.push({ url: entry.url, title: entry.title, snippet });
      }
    }
    return { titleHits, contentHits };
  }

  // embed/static/src/terminal.js
  (function() {
    "use strict";
    var SITE = window.__SITE_DATA__;
    var currentPath = window.__CURRENT_PATH__ || "/";
    var currentViewPath = currentPath;
    var output = document.getElementById("terminal-output");
    var input = document.getElementById("terminal-input");
    var body = document.getElementById("terminal-body");
    var promptPath = document.getElementById("prompt-path");
    var history = JSON.parse(localStorage.getItem("ss_history") || "[]");
    var historyIndex = -1;
    var initialContent = output.innerHTML;
    var findIndex = null;
    var suppressScroll = false;
    function scrollToBottom() {
      output.scrollTop = output.scrollHeight;
    }
    function buildPageHTML(page) {
      var html = "";
      if (page.bannerHTML) {
        html += '<pre class="post-banner">' + page.bannerHTML + "</pre>";
      }
      if (page.template === "post") {
        html += '<div class="post-header">';
        html += '<h1 class="post-header__title">' + escapeHtml(page.title) + "</h1>";
        html += '<div class="post-header__meta">';
        if (page.date) {
          html += "<span>" + escapeHtml(page.date) + "</span>";
        }
        if (page.readingTime) {
          html += "<span>" + page.readingTime + " min read</span>";
        }
        if (page.tags && page.tags.length) {
          html += '<div class="tags">';
          for (var i = 0; i < page.tags.length; i++) {
            html += '<a href="/' + SITE.postsDir + "/tags/" + encodeURIComponent(page.tags[i]) + '" class="tag">#' + escapeHtml(page.tags[i]) + "</a>";
          }
          html += "</div>";
        }
        html += "</div></div>";
      }
      html += page.content;
      return html;
    }
    function updatePromptPath() {
      promptPath.textContent = "~" + currentPath;
    }
    function appendOutput(html, className) {
      var div = document.createElement("div");
      div.className = "terminal__line" + (className ? " terminal__line--" + className : "");
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
      var line = document.createElement("div");
      line.className = "terminal__line";
      var promptHTML = "";
      if (prompt) {
        promptHTML = '<span style="color:var(--ss-prompt-user)">' + escapeHtml(prompt) + '</span><span style="color:var(--ss-prompt-separator)">:</span>';
      }
      line.innerHTML = promptHTML + '<span style="color:var(--ss-prompt-path)">~' + escapeHtml(currentPath) + '</span><span style="color:var(--ss-prompt-separator)">$</span> ' + escapeHtml(cmd);
      output.appendChild(line);
    }
    function resolvePath2(target) {
      return resolvePath(currentPath, target);
    }
    function findPage2(path) {
      return findPage(SITE.pages, path);
    }
    function getNavEntries2(path) {
      return getNavEntries(SITE, path);
    }
    function navigateTo(path, pushState) {
      var page = findPage2(path);
      var entries = getNavEntries2(path);
      if (!page && entries.length === 0 && path !== "/") {
        return false;
      }
      currentViewPath = path;
      var isDir = !page || entries.length > 0;
      if (isDir) {
        currentPath = path;
      } else {
        var parts = path.split("/").filter(Boolean);
        parts.pop();
        currentPath = parts.length ? "/" + parts.join("/") : "/";
      }
      updatePromptPath();
      updateActiveNav();
      if (pushState !== false) {
        window.history.pushState({ path }, "", path === "/" ? "/" : path);
      }
      return path;
    }
    function updateActiveNav() {
      var links = document.querySelectorAll(".terminal__nav-link");
      for (var i = 0; i < links.length; i++) {
        var linkPath = links[i].getAttribute("data-path");
        if (linkPath === currentViewPath || currentViewPath.indexOf(linkPath) === 0 && linkPath !== "/") {
          links[i].classList.add("terminal__nav-link--active");
        } else if (linkPath === "/" && currentViewPath === "/") {
          links[i].classList.add("terminal__nav-link--active");
        } else {
          links[i].classList.remove("terminal__nav-link--active");
        }
      }
    }
    var commands = {
      help: function() {
        var lines = [
          '<span style="color:var(--ss-accent)">Available commands:</span>',
          "",
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
          "",
          "You can also click any link to navigate."
        ];
        for (var i = 0; i < lines.length; i++) {
          appendOutput(lines[i]);
        }
      },
      ls: function(args) {
        var targetPath = currentPath;
        if (args && args.length > 0) {
          targetPath = resolvePath2(args[0]);
          var targetEntries = getNavEntries2(targetPath);
          if (targetEntries.length === 0 && !findPage2(targetPath)) {
            appendOutput("ls: cannot access '" + escapeHtml(args[0]) + "': No such file or directory", "error");
            return;
          }
        }
        var entries = getNavEntries2(targetPath);
        if (entries.length === 0) {
          appendOutput("(empty)", "system");
          return;
        }
        var grid = document.createElement("div");
        grid.className = "ls-output";
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          var item = document.createElement("a");
          item.className = "ls-item ls-item--" + entry.type;
          item.textContent = entry.name;
          item.href = entry.url;
          item.setAttribute("data-nav", entry.url);
          item.title = entry.title;
          item.setAttribute("data-type", entry.type);
          item.addEventListener("click", function(e) {
            e.preventDefault();
            var target = this.getAttribute("data-nav");
            var type = this.getAttribute("data-type");
            executeCommand((type === "file" ? "open " : "cd ") + target.split("/").pop());
          });
          grid.appendChild(item);
        }
        var maxLen = 0;
        for (var j = 0; j < entries.length; j++) {
          var nameLen = entries[j].name.length + (entries[j].type === "dir" ? 1 : 0);
          if (nameLen > maxLen) maxLen = nameLen;
        }
        grid.style.setProperty("--ls-col-width", maxLen + 2 + "ch");
        appendRaw(grid);
      },
      cd: function(args) {
        if (!args || args.length === 0) {
          var p = navigateTo("/");
          showPageContent(p);
          return;
        }
        var target = args[0];
        var resolved = resolvePath2(target);
        if (resolved === currentPath) {
          showPageContent(resolved);
          return;
        }
        var p = navigateTo(resolved);
        if (!p && target === "..") {
          var parts = resolved.split("/").filter(Boolean);
          while (parts.length > 0) {
            parts.pop();
            var ancestor = parts.length ? "/" + parts.join("/") : "/";
            p = navigateTo(ancestor);
            if (p) break;
          }
        }
        if (p) {
          showPageContent(p);
        } else {
          appendOutput("cd: no such directory: " + escapeHtml(target), "error");
        }
      },
      open: function(args) {
        if (!args || args.length === 0) {
          appendOutput("open: missing file operand", "error");
          return;
        }
        var target = args[0];
        var resolved = resolvePath2(target);
        var page = findPage2(resolved);
        if (!page) {
          var pages = SITE.pages || {};
          for (var url in pages) {
            if (!pages.hasOwnProperty(url)) continue;
            var slug = url.split("/").pop();
            if (slug === target) {
              resolved = url;
              page = pages[url];
              break;
            }
          }
        }
        if (!page) {
          appendOutput("open: " + escapeHtml(target) + ": No such file", "error");
          return;
        }
        var p = navigateTo(resolved);
        showPageContent(p);
      },
      clear: function() {
        output.innerHTML = "";
      },
      history: function() {
        if (history.length === 0) {
          appendOutput("(no history)", "system");
          return;
        }
        for (var i = 0; i < history.length; i++) {
          appendOutput("  " + (i + 1) + "  " + escapeHtml(history[i]));
        }
      },
      theme: function(args) {
        if (!args || args.length === 0) {
          appendOutput("Usage: theme &lt;name&gt;", "system");
          appendOutput("Available: system, light, dark", "system");
          return;
        }
        var name = args[0];
        if (name === "system" || name === "light" || name === "dark") {
          applyTheme(name);
          appendOutput("Theme switched to " + escapeHtml(name), "system");
        } else {
          appendOutput("theme: unknown theme: " + escapeHtml(name), "error");
          appendOutput("Available: system, light, dark", "system");
        }
      },
      pwd: function() {
        appendOutput("~" + currentPath);
      },
      date: function() {
        appendOutput((/* @__PURE__ */ new Date()).toString());
      },
      whoami: function() {
        var info = SITE.terminal.whoami;
        if (info) {
          appendOutput(info);
        } else {
          appendOutput("whoami: not configured", "system");
        }
      },
      find: function(args) {
        var query = args && args.length > 0 ? args.join(" ").toLowerCase() : "";
        if (!query) {
          appendOutput("Usage: find &lt;query&gt;", "system");
          return;
        }
        function renderResults(results) {
          if (results.titleHits.length === 0 && results.contentHits.length === 0) {
            appendOutput("No results for '" + escapeHtml(args.join(" ")) + "'", "system");
            return;
          }
          for (var i = 0; i < results.titleHits.length; i++) {
            var r = results.titleHits[i];
            var link = '<a href="' + r.url + '" data-nav="' + r.url + '" style="color:var(--ss-green);cursor:pointer">' + escapeHtml(r.url) + "</a>";
            appendOutput("  " + link + "  " + escapeHtml(r.title));
          }
          for (var j = 0; j < results.contentHits.length; j++) {
            var c = results.contentHits[j];
            var cLink = '<a href="' + c.url + '" data-nav="' + c.url + '" style="color:var(--ss-green);cursor:pointer">' + escapeHtml(c.url) + "</a>";
            appendOutput("  " + cLink + "  " + escapeHtml(c.title));
            appendOutput('    <span style="color:var(--ss-dim)">' + escapeHtml(c.snippet) + "</span>");
          }
        }
        if (findIndex) {
          renderResults(searchIndex(findIndex, query));
        } else {
          fetch("/find.json").then(function(r) {
            return r.json();
          }).then(function(data) {
            findIndex = data;
            renderResults(searchIndex(data, query));
          }).catch(function() {
            appendOutput("find: failed to load search index", "error");
          });
        }
      },
      tree: function(args) {
        var root = currentPath;
        if (args && args.length > 0) {
          root = resolvePath2(args[0]);
          var entries = getNavEntries2(root);
          if (entries.length === 0 && !findPage2(root)) {
            appendOutput("tree: '" + escapeHtml(args[0]) + "': No such directory", "error");
            return;
          }
        }
        function buildTree(path, prefix) {
          var entries2 = getNavEntries2(path);
          for (var i = 0; i < entries2.length; i++) {
            var entry = entries2[i];
            var isLast = i === entries2.length - 1;
            var connector = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
            var color = entry.type === "dir" ? "var(--ss-blue)" : "var(--ss-green)";
            var display = entry.type === "dir" ? entry.name + "/" : entry.name;
            appendOutput(prefix + connector + '<span style="color:' + color + '">' + escapeHtml(display) + "</span>");
            if (entry.type === "dir") {
              var childPrefix = prefix + (isLast ? "    " : "\u2502   ");
              buildTree(entry.url, childPrefix);
            }
          }
        }
        appendOutput('<span style="color:var(--ss-blue)">.</span>');
        buildTree(root, "");
      }
    };
    function showPageContent(pagePath) {
      var resolvedPath = pagePath || currentPath;
      var page = findPage2(resolvedPath);
      if (page) {
        var content = document.createElement("div");
        content.className = "content";
        content.innerHTML = buildPageHTML(page);
        output.innerHTML = "";
        output.appendChild(content);
      } else {
        output.innerHTML = "";
        commands.ls();
      }
      if (resolvedPath === "/") showWelcome();
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
        localStorage.setItem("ss_history", JSON.stringify(history));
      }
      historyIndex = -1;
      if (commands[cmd]) {
        commands[cmd](args);
      } else if (cmd) {
        appendOutput("command not found: " + escapeHtml(cmd) + '. Type <span style="color:var(--ss-green)">help</span> for available commands.', "error");
      }
      if (suppressScroll) {
        suppressScroll = false;
      } else {
        scrollToBottom();
      }
    }
    function getCompletions2(partial) {
      var entries = getNavEntries2(currentPath);
      var cmdNames = Object.keys(commands);
      return getCompletions(entries, cmdNames, partial);
    }
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        var cmd = input.value;
        input.value = "";
        if (cmd.trim()) {
          executeCommand(cmd);
        }
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        if (historyIndex === -1) {
          historyIndex = history.length - 1;
        } else if (historyIndex > 0) {
          historyIndex--;
        }
        input.value = history[historyIndex];
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex === -1) return;
        if (historyIndex < history.length - 1) {
          historyIndex++;
          input.value = history[historyIndex];
        } else {
          historyIndex = -1;
          input.value = "";
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        var val = input.value;
        var parts = val.split(/\s+/);
        var last = parts[parts.length - 1];
        if (last) {
          var completions = getCompletions2(last);
          if (completions.length === 1) {
            parts[parts.length - 1] = completions[0];
            input.value = parts.join(" ");
          } else if (completions.length > 1) {
            appendPromptEcho(val);
            appendOutput(completions.join("  "), "system");
          }
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        commands.clear();
      }
    });
    body.addEventListener("click", function(e) {
      if (e.target.tagName !== "A" && e.target.tagName !== "INPUT") {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          input.focus();
        }
      }
    });
    document.addEventListener("keydown", function(e) {
      if (e.key === "/" && document.activeElement !== input) {
        e.preventDefault();
        if (document.activeElement) document.activeElement.blur();
        input.focus();
        input.scrollIntoView({ block: "nearest" });
      }
    });
    document.addEventListener("click", function(e) {
      var link = e.target.closest(".terminal__nav-link");
      if (link) {
        e.preventDefault();
        var path = link.getAttribute("data-path");
        var p = navigateTo(path);
        if (p) {
          showPageContent(p);
        }
      }
      var navLink = e.target.closest("[data-nav]");
      if (navLink) {
        e.preventDefault();
        var navPath = navLink.getAttribute("data-nav");
        var p = navigateTo(navPath);
        if (p) {
          showPageContent(p);
        }
      }
    });
    window.addEventListener("popstate", function(e) {
      if (e.state && e.state.path) {
        var p = navigateTo(e.state.path, false);
        if (p) showPageContent(p);
      }
    });
    function showWelcome() {
      if (currentPath !== "/") return;
      var bannerHTML = SITE.terminal.bannerHTML;
      var art = SITE.terminal.asciiArt;
      if (!bannerHTML && !art) return;
      var container = document.createElement("div");
      if (bannerHTML) {
        var banner = document.createElement("div");
        banner.className = "banner";
        banner.innerHTML = bannerHTML;
        container.appendChild(banner);
      } else {
        var lines = art.split("\n");
        for (var i = 0; i < lines.length; i++) {
          var line = document.createElement("div");
          line.className = "terminal__line terminal__line--ascii";
          line.textContent = lines[i];
          container.appendChild(line);
        }
      }
      var spacer = document.createElement("div");
      spacer.className = "terminal__line";
      spacer.innerHTML = "&nbsp;";
      container.appendChild(spacer);
      var hint = document.createElement("div");
      hint.className = "terminal__line terminal__line--system";
      hint.textContent = "Type help for available commands, or click around to navigate.";
      container.appendChild(hint);
      var spacer2 = document.createElement("div");
      spacer2.className = "terminal__line";
      spacer2.innerHTML = "&nbsp;";
      container.appendChild(spacer2);
      output.insertBefore(container, output.firstChild);
      scrollToBottom();
    }
    var themeCache = {};
    var darkMedia = window.matchMedia("(prefers-color-scheme: dark)");
    function applyThemeCSS(name) {
      if (themeCache[name]) {
        setThemeStyle(themeCache[name]);
        return;
      }
      fetch("/" + name + "-theme.css").then(function(r) {
        return r.ok ? r.text() : "";
      }).then(function(css) {
        if (css) {
          themeCache[name] = css;
          setThemeStyle(css);
        }
      });
    }
    function setThemeStyle(css) {
      var early = document.getElementById("ss-theme-early");
      if (early) early.remove();
      var style = document.getElementById("ss-theme-override");
      if (!style) {
        style = document.createElement("style");
        style.id = "ss-theme-override";
        document.head.appendChild(style);
      }
      style.textContent = css;
    }
    function applyTheme(mode) {
      localStorage.setItem("ss_theme", mode);
      var isLight;
      if (mode === "system") {
        isLight = !darkMedia.matches;
        applyThemeCSS(isLight ? "light" : "terminal");
      } else if (mode === "light") {
        isLight = true;
        applyThemeCSS("light");
      } else {
        isLight = false;
        applyThemeCSS("terminal");
      }
      document.documentElement.setAttribute("data-code-theme", isLight ? "light" : "dark");
      var btns = document.querySelectorAll(".theme-toggle__btn");
      for (var i = 0; i < btns.length; i++) {
        var btn = btns[i];
        if (btn.getAttribute("data-theme") === mode) {
          btn.classList.add("theme-toggle__btn--active");
        } else {
          btn.classList.remove("theme-toggle__btn--active");
        }
      }
    }
    var toggleEl = document.getElementById("theme-toggle");
    if (toggleEl) {
      toggleEl.addEventListener("click", function(e) {
        var btn = e.target.closest(".theme-toggle__btn");
        if (btn) applyTheme(btn.getAttribute("data-theme"));
      });
    }
    darkMedia.addEventListener("change", function() {
      if ((localStorage.getItem("ss_theme") || "system") === "system") {
        applyThemeCSS(darkMedia.matches ? "terminal" : "light");
        document.documentElement.setAttribute("data-code-theme", darkMedia.matches ? "dark" : "light");
      }
    });
    var savedTheme = localStorage.getItem("ss_theme") || "system";
    applyTheme(savedTheme);
    window.history.replaceState({ path: currentPath }, "", window.location.pathname);
    updateActiveNav();
    showWelcome();
    input.focus();
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      var es = new EventSource("/_reload");
      es.onmessage = function() {
        location.reload();
      };
      es.onerror = function() {
        setTimeout(function() {
          es.close();
        }, 5e3);
      };
    }
  })();
})();
