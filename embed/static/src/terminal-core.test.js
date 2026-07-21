import { describe, it, expect } from 'vitest';
import { escapeHtml, resolvePath, findPage, getNavEntries, getCompletions, searchIndex } from './terminal-core.js';

describe('escapeHtml', () => {
  it('passes plain text through', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles multiple special chars together', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;'
    );
  });
});

describe('resolvePath', () => {
  it('.. from root stays at root', () => {
    expect(resolvePath('/', '..')).toBe('/');
  });

  it('.. from /blog goes to root', () => {
    expect(resolvePath('/blog', '..')).toBe('/');
  });

  it('.. from /blog/posts goes to /blog', () => {
    expect(resolvePath('/blog/posts', '..')).toBe('/blog');
  });

  it('. returns current path', () => {
    expect(resolvePath('/about', '.')).toBe('/about');
  });

  it('~ resolves to root', () => {
    expect(resolvePath('/anywhere', '~')).toBe('/');
  });

  it('/ resolves to root', () => {
    expect(resolvePath('/deep/path', '/')).toBe('/');
  });

  it('absolute path passes through', () => {
    expect(resolvePath('/current', '/other')).toBe('/other');
  });

  it('relative from root', () => {
    expect(resolvePath('/', 'about')).toBe('/about');
  });

  it('relative from subpath', () => {
    expect(resolvePath('/blog', 'my-post')).toBe('/blog/my-post');
  });
});

describe('findPage', () => {
  const pages = {
    '/': { title: 'Home' },
    '/about': { title: 'About' },
    '/blog/post-1': { title: 'Post 1' },
  };

  it('finds existing page', () => {
    expect(findPage(pages, '/about')).toEqual({ title: 'About' });
  });

  it('returns null for missing page', () => {
    expect(findPage(pages, '/nonexistent')).toBeNull();
  });

  it('finds root page', () => {
    expect(findPage(pages, '/')).toEqual({ title: 'Home' });
  });
});

describe('getNavEntries', () => {
  const site = {
    postsDir: 'blog',
    pages: {
      '/': { title: 'Home' },
      '/about': { title: 'About' },
      '/projects': { title: 'Projects' },
      '/projects/foo': { title: 'Foo' },
      '/projects/bar': { title: 'Bar' },
      '/blog': { title: 'Blog' },
      '/blog/post-a': { title: 'Post A' },
      '/blog/post-b': { title: 'Post B' },
    },
    blog: { posts: [{ title: 'Post A' }] },
  };

  it('lists top-level entries at root', () => {
    const entries = getNavEntries(site, '/');
    const names = entries.map(e => e.name);
    expect(names).toContain('about');
    expect(names).toContain('projects');
    expect(names).toContain('blog');
  });

  it('excludes root index page', () => {
    const entries = getNavEntries(site, '/');
    const urls = entries.map(e => e.url);
    expect(urls).not.toContain('/');
  });

  it('detects directories (pages with children)', () => {
    const entries = getNavEntries(site, '/');
    const projects = entries.find(e => e.name === 'projects');
    expect(projects.type).toBe('dir');
  });

  it('detects files (pages without children)', () => {
    const entries = getNavEntries(site, '/');
    const about = entries.find(e => e.name === 'about');
    expect(about.type).toBe('file');
  });

  it('lists posts in posts directory', () => {
    const entries = getNavEntries(site, '/blog');
    const names = entries.map(e => e.name);
    expect(names).toContain('post-a');
    expect(names).toContain('post-b');
  });

  it('lists children of arbitrary subpath', () => {
    const entries = getNavEntries(site, '/projects');
    const names = entries.map(e => e.name);
    expect(names).toEqual(['bar', 'foo']);
  });

  it('sorts dirs first then alphabetical', () => {
    const entries = getNavEntries(site, '/');
    const dirIdx = entries.findIndex(e => e.type === 'dir');
    const fileIdx = entries.findIndex(e => e.type === 'file');
    if (dirIdx !== -1 && fileIdx !== -1) {
      expect(dirIdx).toBeLessThan(fileIdx);
    }
  });

  it('returns empty for path with no children', () => {
    const entries = getNavEntries(site, '/about');
    expect(entries).toEqual([]);
  });

  it('adds posts dir at root when blog has posts but no page entry', () => {
    const siteNoPostsPage = {
      postsDir: 'articles',
      pages: {
        '/': { title: 'Home' },
        '/about': { title: 'About' },
      },
      blog: { posts: [{ title: 'X' }] },
    };
    const entries = getNavEntries(siteNoPostsPage, '/');
    const articlesDir = entries.find(e => e.name === 'articles');
    expect(articlesDir).toBeDefined();
    expect(articlesDir.type).toBe('dir');
  });
});

describe('getCompletions', () => {
  const entries = [
    { name: 'about' },
    { name: 'blog' },
    { name: 'projects' },
  ];
  const commandNames = ['help', 'ls', 'cd', 'open', 'find', 'history'];

  it('matches entry names by prefix', () => {
    expect(getCompletions(entries, commandNames, 'ab')).toEqual(['about']);
  });

  it('matches command names by prefix', () => {
    expect(getCompletions(entries, commandNames, 'he')).toEqual(['help']);
  });

  it('returns multiple matches', () => {
    const result = getCompletions(entries, commandNames, 'h');
    expect(result).toContain('help');
    expect(result).toContain('history');
  });

  it('returns empty for no match', () => {
    expect(getCompletions(entries, commandNames, 'xyz')).toEqual([]);
  });

  it('matches both entries and commands', () => {
    const entries2 = [{ name: 'hello-world' }];
    const result = getCompletions(entries2, commandNames, 'h');
    expect(result).toContain('hello-world');
    expect(result).toContain('help');
    expect(result).toContain('history');
  });
});

describe('searchIndex', () => {
  const index = {
    '/about': {
      url: '/about',
      title: 'About Me',
      content: 'I am a software developer working on interesting projects.',
    },
    '/blog/hello': {
      url: '/blog/hello',
      title: 'Hello World',
      content: 'This is my first blog post about programming.',
    },
    '/blog/rust': {
      url: '/blog/rust',
      title: 'Learning Rust',
      content: 'Rust is a systems programming language focused on safety.',
    },
    '/projects': {
      url: '/projects',
      title: 'Projects',
      content: 'Here are some projects I have built.',
    },
  };

  it('finds title matches', () => {
    const result = searchIndex(index, 'hello');
    expect(result.titleHits.length).toBe(1);
    expect(result.titleHits[0].url).toBe('/blog/hello');
  });

  it('finds URL matches as title hits', () => {
    const result = searchIndex(index, 'rust');
    expect(result.titleHits.length).toBe(1);
    expect(result.titleHits[0].url).toBe('/blog/rust');
  });

  it('finds content matches with snippets', () => {
    const result = searchIndex(index, 'interesting');
    expect(result.contentHits.length).toBe(1);
    expect(result.contentHits[0].url).toBe('/about');
    expect(result.contentHits[0].snippet).toContain('interesting');
  });

  it('returns empty arrays for no match', () => {
    const result = searchIndex(index, 'nonexistent');
    expect(result.titleHits).toEqual([]);
    expect(result.contentHits).toEqual([]);
  });

  it('is case insensitive', () => {
    const result = searchIndex(index, 'HELLO');
    expect(result.titleHits.length).toBe(1);
    expect(result.titleHits[0].url).toBe('/blog/hello');
  });

  it('prefers title/url over content match', () => {
    const isolated = {
      '/alpha': { url: '/alpha', title: 'Alpha Page', content: 'alpha appears in content too' },
      '/beta': { url: '/beta', title: 'Beta', content: 'no match here' },
    };
    const result = searchIndex(isolated, 'alpha');
    expect(result.titleHits.length).toBe(1);
    expect(result.titleHits[0].url).toBe('/alpha');
    expect(result.contentHits.length).toBe(0);
  });

  it('adds ellipsis to snippet when not at start', () => {
    const longContent = {
      '/long': {
        url: '/long',
        title: 'Long Page',
        content: 'A'.repeat(100) + 'needle' + 'B'.repeat(100),
      },
    };
    const result = searchIndex(longContent, 'needle');
    expect(result.contentHits[0].snippet).toMatch(/^\.\.\./);
    expect(result.contentHits[0].snippet).toMatch(/\.\.\.$/);
  });

  it('no leading ellipsis when match is near start', () => {
    const shortContent = {
      '/short': {
        url: '/short',
        title: 'Short Page',
        content: 'needle in a haystack',
      },
    };
    const result = searchIndex(shortContent, 'needle');
    expect(result.contentHits[0].snippet).not.toMatch(/^\.\.\./);
  });
});
