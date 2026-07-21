export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolvePath(currentPath, target) {
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

export function findPage(pages, path) {
  return pages[path] || null;
}

export function getNavEntries(site, path) {
  var entries = [];
  var pages = site.pages || {};

  for (var url in pages) {
    if (!pages.hasOwnProperty(url)) continue;
    var page = pages[url];

    if (path === '/') {
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
    } else if (path === '/' + site.postsDir) {
      var postsPrefix = '/' + site.postsDir + '/';
      if (url.indexOf(postsPrefix) === 0 && url !== '/' + site.postsDir) {
        var slug = url.substring(postsPrefix.length);
        if (slug.indexOf('/') === -1) {
          entries.push({ name: slug, type: 'file', url: url, title: page.title });
        }
      }
    } else {
      var prefix = path + '/';
      if (url.indexOf(prefix) === 0) {
        var rest = url.substring(prefix.length);
        if (rest.indexOf('/') === -1) {
          entries.push({ name: rest, type: 'file', url: url, title: page.title });
        }
      }
    }
  }

  if (path === '/') {
    var postsDir = site.postsDir;
    var hasPostsDir = false;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name === postsDir) { hasPostsDir = true; break; }
    }
    var blogPosts = site.blog && site.blog.posts;
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

export function getCompletions(entries, commandNames, partial) {
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

export function searchIndex(index, query) {
  var titleHits = [];
  var contentHits = [];
  var lowerQuery = query.toLowerCase();

  for (var url in index) {
    if (!index.hasOwnProperty(url)) continue;
    var entry = index[url];
    var title = (entry.title || '').toLowerCase();
    var content = entry.content || '';

    if (title.indexOf(lowerQuery) !== -1 || url.toLowerCase().indexOf(lowerQuery) !== -1) {
      titleHits.push(entry);
    } else if (content.indexOf(lowerQuery) !== -1) {
      var idx = content.indexOf(lowerQuery);
      var start = Math.max(0, idx - 40);
      var end = Math.min(content.length, idx + lowerQuery.length + 40);
      var snippet = (start > 0 ? '...' : '') +
        content.substring(start, end) +
        (end < content.length ? '...' : '');
      contentHits.push({ url: entry.url, title: entry.title, snippet: snippet });
    }
  }

  return { titleHits: titleHits, contentHits: contentHits };
}
