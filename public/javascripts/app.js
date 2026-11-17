(function () {
  'use strict';

  const content = document.getElementById('page-content');
  if (!content) return;

  const audio = document.getElementById('audio-element');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchKind = document.getElementById('search-kind');
  const toast = document.getElementById('toast');
  const lyricsModal = document.getElementById('lyrics-modal');
  const lyricsBody = document.getElementById('lyrics-body');
  const state = {
    favorites: [],
    currentSong: null,
    queue: [],
    queueIndex: -1,
    songLists: {},
    listSequence: 0,
    repeat: 'off',
    renderToken: 0,
    playToken: 0,
    toastTimer: null,
    lyrics: [],
    activeLyricIndex: -1,
    singerView: null,
    singerResults: null,
    searchView: null,
  };
  const savedFavorites = readStorage('migu-music:favorites', []);
  if (Array.isArray(savedFavorites)) {
    state.favorites = savedFavorites;
  } else {
    showToast('本地收藏数据格式异常，已使用空列表。');
  }

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      showToast('无法读取本地音乐数据：' + error.message);
      return fallback;
    }
  }

  function saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showToast('无法保存到本地：' + error.message);
      return false;
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char];
    });
  }

  function safeImageUrl(value) {
    const url = String(value || '');
    if (url.indexOf('//') === 0) return 'https:' + url;
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function imageMarkup(url, className, alt) {
    const src = safeImageUrl(url);
    return '<span class="' + escapeHTML(className) + (src ? '' : ' is-missing') + '">'
      + (src ? '<img src="' + escapeHTML(src) + '" alt="' + escapeHTML(alt || '') + '" loading="lazy">' : '')
      + '<span class="cover-note" aria-hidden="true">♪</span></span>';
  }

  function cardArtMarkup(url) {
    const src = safeImageUrl(url);
    return '<span class="media-card-art">'
      + (src ? '<img src="' + escapeHTML(src) + '" alt="" loading="lazy">' : '')
      + '<span class="cover-note" aria-hidden="true">♪</span>'
      + '<span class="card-play-overlay" aria-hidden="true">▶</span></span>';
  }

  function api(path) {
    return fetch(path, { headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('请求失败（HTTP ' + response.status + '）');
      return response.json();
    }).then(function (result) {
      if (!result || result.result !== 100) {
        throw new Error(result && result.errMsg ? result.errMsg : '接口返回异常');
      }
      return result.data;
    });
  }

  function settleApi(path) {
    return api(path).then(function (data) {
      return { data: data };
    }).catch(function (error) {
      return { error: error.message };
    });
  }

  function registerSongs(songs) {
    const key = 'song-list-' + (++state.listSequence);
    state.songLists[key] = Array.isArray(songs) ? songs : [];
    return key;
  }

  function songKey(song) {
    return String(song && (song.cid || song.copyrightId || song.id) || '');
  }

  function isFavorite(song) {
    const key = songKey(song);
    return !!key && state.favorites.some(function (item) {
      return songKey(item) === key;
    });
  }

  function artistNames(artists) {
    return (Array.isArray(artists) ? artists : [])
      .map(function (artist) { return artist && artist.name; })
      .filter(Boolean)
      .join(' / ') || '未知歌手';
  }

  function artistMarkup(artists) {
    const list = Array.isArray(artists) ? artists : [];
    if (!list.length) return '<span>未知歌手</span>';
    return list.map(function (artist, index) {
      const name = escapeHTML(artist && artist.name || '未知歌手');
      const id = artist && artist.id;
      const separator = index ? '<span aria-hidden="true"> / </span>' : '';
      return separator + (id
        ? '<button class="artist-name" type="button" data-route="/singer/' + escapeHTML(encodeURIComponent(id)) + '">' + name + '</button>'
        : '<span>' + name + '</span>');
    }).join('');
  }

  function formatTime(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return minutes + ':' + String(remainder).padStart(2, '0');
  }

  function formatCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number.toLocaleString('zh-CN') : '—';
  }

  function renderSongList(songs, options) {
    const list = Array.isArray(songs) ? songs : [];
    if (!list.length) {
      return '<div class="empty-state"><strong>这里还没有歌曲</strong><span>试试搜索其他内容，或稍后再来看看。</span></div>';
    }

    const listId = registerSongs(list);
    return '<div class="song-list" role="list">' + list.map(function (song, index) {
      const album = song.album || {};
      const albumButton = album.id
        ? '<button class="song-album" type="button" data-route="/album/' + escapeHTML(encodeURIComponent(album.id)) + '">' + escapeHTML(album.name || '未知专辑') + '</button>'
        : '<span class="song-album">' + escapeHTML(album.name || '未知专辑') + '</span>';
      const favorite = isFavorite(song);
      return '<article class="song-row" role="listitem">'
        + '<span class="song-rank">' + String(index + 1).padStart(2, '0') + '</span>'
        + imageMarkup(song.picUrl || album.picUrl, 'cover', '')
        + '<div class="song-info">'
        + '<button class="song-title" type="button" data-action="play-song" data-list="' + listId + '" data-index="' + index + '">' + escapeHTML(song.name || '未知歌曲') + '</button>'
        + '<div class="song-subtitle">' + artistMarkup(song.artists) + '</div>'
        + '</div>'
        + albumButton
        + '<span class="song-duration">' + (song.duration ? formatTime(song.duration) : '—') + '</span>'
        + '<div class="song-actions">'
        + '<button class="round-action" type="button" data-action="play-song" data-list="' + listId + '" data-index="' + index + '" aria-label="播放 ' + escapeHTML(song.name || '') + '" title="播放">▶</button>'
        + '<button class="round-action' + (favorite ? ' is-favorite' : '') + '" type="button" data-action="favorite-song" data-list="' + listId + '" data-index="' + index + '" aria-label="' + (favorite ? '取消收藏' : '收藏') + '" title="' + (favorite ? '取消收藏' : '收藏') + '">' + (favorite ? '♥' : '♡') + '</button>'
        + '</div></article>';
    }).join('') + '</div>';
  }

  function renderMediaCards(items, kind) {
    const list = Array.isArray(items) ? items.filter(function (item) { return item && item.id; }) : [];
    if (!list.length) return '<div class="empty-state"><strong>暂时没有内容</strong><span>稍后再来看看，或试试搜索。</span></div>';

    return '<div class="card-grid">' + list.map(function (item) {
      let route = '';
      let subtitle = '';
      if (kind === 'album') {
        route = '/album/' + encodeURIComponent(item.id);
        subtitle = artistNames(item.artists);
      } else {
        route = '/playlist/' + encodeURIComponent(item.id);
        subtitle = item.creator && item.creator.name
          ? item.creator.name
          : (item.playCount ? '播放 ' + formatCount(item.playCount) : '歌单');
      }
      return '<button class="media-card" type="button" data-route="' + escapeHTML(route) + '">'
        + cardArtMarkup(item.picUrl)
        + '<span class="media-card-title">' + escapeHTML(item.name || '未命名') + '</span>'
        + '<span class="media-card-subtitle">' + escapeHTML(subtitle) + '</span></button>';
    }).join('') + '</div>';
  }

  function renderArtistCards(items) {
    const list = Array.isArray(items) ? items.filter(function (item) { return item && item.id; }) : [];
    if (!list.length) return '<div class="empty-state"><strong>没有找到歌手</strong><span>换个关键词试试看。</span></div>';
    return '<div class="artist-grid">' + list.map(function (artist) {
      const src = safeImageUrl(artist.picUrl);
      return '<button class="artist-card" type="button" data-route="/singer/' + escapeHTML(encodeURIComponent(artist.id)) + '">'
        + '<span class="artist-avatar">' + (src
          ? '<img src="' + escapeHTML(src) + '" alt="" loading="lazy">'
          : escapeHTML(String(artist.name || '♪').slice(0, 1))) + '</span>'
        + '<strong>' + escapeHTML(artist.name || '未知歌手') + '</strong>'
        + '<small>查看歌手主页</small></button>';
    }).join('') + '</div>';
  }

  function sectionHeading(title, subtitle, route) {
    return '<div class="section-heading"><div><h2>' + escapeHTML(title) + '</h2>'
      + (subtitle ? '<p>' + escapeHTML(subtitle) + '</p>' : '')
      + '</div>' + (route
        ? '<button class="text-action" type="button" data-route="' + escapeHTML(route) + '">查看全部　→</button>'
        : '') + '</div>';
  }

  function renderSection(title, subtitle, body, route) {
    return '<section class="content-section">' + sectionHeading(title, subtitle, route) + body + '</section>';
  }

  function setContext(label, route) {
    const context = document.getElementById('context-label');
    if (context) context.textContent = label;
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-route') === route);
    });
  }

  function parseLocation() {
    const hash = window.location.hash.replace(/^#/, '') || '/home';
    const separator = hash.indexOf('?');
    const path = separator < 0 ? hash : hash.slice(0, separator);
    const query = new URLSearchParams(separator < 0 ? '' : hash.slice(separator + 1));
    return { path: path || '/home', query: query };
  }

  function navigate(route) {
    const target = route.charAt(0) === '#' ? route : '#' + route;
    if (window.location.hash === target) {
      renderRoute();
    } else {
      window.location.hash = target;
    }
  }

  function searchRoute(keyword, type, pageNo) {
    return '/search?keyword=' + encodeURIComponent(keyword)
      + '&type=' + encodeURIComponent(type || 'song')
      + (pageNo && pageNo > 1 ? '&pageNo=' + pageNo : '');
  }

  function loadingMarkup() {
    return '<div class="loading-state"><div><div class="loading-indicator"></div>'
      + '<div class="loading-stack"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>'
      + '</div></div>';
  }

  function inlineError(message) {
    return '<div class="inline-state error-state">' + escapeHTML(message || '暂时无法加载，请稍后重试。') + '</div>';
  }

  async function renderHome(token) {
    setContext('音乐空间', '/home');
    const results = await Promise.all([
      settleApi('/new/songs?pageNo=1&pageSize=10'),
      settleApi('/new/albums?pageNo=1&pageSize=8'),
      settleApi('/recommend/playlist?pageNo=1&type=1'),
    ]);
    if (token !== state.renderToken) return;

    const songs = results[0].data && results[0].data.list || [];
    const albums = results[1].data && results[1].data.list || [];
    const playlists = results[2].data && results[2].data.list || [];
    const featured = songs[0] || {};
    const featuredAlbum = albums[0] || {};
    const heroList = registerSongs(featured.name ? [featured] : []);
    const songSection = results[0].error
      ? inlineError(results[0].error)
      : renderSongList(songs.slice(0, 5));
    const albumSection = results[1].error
      ? inlineError(results[1].error)
      : renderMediaCards(albums.slice(0, 4), 'album');
    const playlistSection = results[2].error
      ? inlineError(results[2].error)
      : renderMediaCards(playlists.slice(0, 4), 'playlist');

    content.innerHTML = '<section class="hero">'
      + '<div class="hero-copy"><span class="eyebrow">MIGU MUSIC SPACE</span>'
      + '<h1>让喜欢的声音<br>自然发生。</h1>'
      + '<p>从一首新歌开始，搜索、发现、收藏，然后安心听下去。</p>'
      + '<div class="hero-actions"><button class="button-primary" type="button" data-route="/new/songs">发现新歌　→</button>'
      + (featured.name
        ? '<button class="button-quiet" type="button" data-action="play-song" data-list="' + heroList + '" data-index="0">▶　播放今日新歌</button>'
        : '') + '</div></div>'
      + '<div class="hero-art" aria-hidden="true"><div class="hero-disc"></div>'
      + imageMarkup(featuredAlbum.picUrl || featured.picUrl, 'cover hero-cover', '') + '</div></section>'
      + '<div class="quick-stats">'
      + '<div class="quick-stat"><span class="quick-stat-icon">♪</span><span><strong>新歌速递</strong><small>' + (songs.length ? songs.length + ' 首正在更新' : '发现近期新声音') + '</small></span></div>'
      + '<div class="quick-stat"><span class="quick-stat-icon">▧</span><span><strong>新专辑</strong><small>' + (albums.length ? albums.length + ' 张值得收藏' : '看看最近发行') + '</small></span></div>'
      + '<div class="quick-stat"><span class="quick-stat-icon">♡</span><span><strong>我的收藏</strong><small>' + state.favorites.length + ' 首私人歌单</small></span></div>'
      + '</div>'
      + renderSection('新歌速递', '先听听最近上新的旋律', songSection, '/new/songs')
      + renderSection('最近发行', '新专辑，新的音乐旅程', albumSection, '/new/albums')
      + renderSection('为你推荐', '从这里发现一张想循环的歌单', playlistSection, '/playlists')
      + '<div class="home-footnote">提示：点击歌曲即可播放，播放链接由当前站点的接口实时获取。</div>';
  }

  async function renderSearch(route, token) {
    const keyword = route.query.get('keyword') || '';
    const type = route.query.get('type') || 'song';
    const pageNo = Math.max(1, Number(route.query.get('pageNo')) || 1);
    searchInput.value = keyword;
    searchKind.value = ['song', 'album', 'singer', 'playlist'].indexOf(type) >= 0 ? type : 'song';
    setContext('搜索结果', '');
    if (!keyword.trim()) {
      content.innerHTML = '<div class="empty-state"><strong>输入关键词，开始搜索</strong><span>试试歌曲名、歌手名、专辑或歌单。</span></div>';
      return;
    }

    const data = await api('/search?keyword=' + encodeURIComponent(keyword)
      + '&type=' + encodeURIComponent(type) + '&pageNo=' + pageNo);
    if (token !== state.renderToken) return;
    state.searchView = { keyword: keyword, type: type, pageNo: pageNo, total: Number(data.total) || 0 };
    const list = Array.isArray(data.list) ? data.list : [];
    state.songLists = {};
    const types = [
      ['song', '单曲'],
      ['album', '专辑'],
      ['singer', '歌手'],
      ['playlist', '歌单'],
    ];
    let resultsMarkup = '';
    if (type === 'song') resultsMarkup = renderSongList(list);
    if (type === 'album') resultsMarkup = renderMediaCards(list, 'album');
    if (type === 'playlist') resultsMarkup = renderMediaCards(list, 'playlist');
    if (type === 'singer') resultsMarkup = renderArtistCards(list);

    const tabs = types.map(function (item) {
      return '<button class="search-tab' + (item[0] === type ? ' is-active' : '')
        + '" type="button" data-action="search-kind" data-type="' + item[0] + '">'
        + item[1] + '</button>';
    }).join('');
    const previous = pageNo > 1
      ? '<button class="button-outline" type="button" data-action="search-page" data-page="' + (pageNo - 1) + '">← 上一页</button>'
      : '';
    const next = list.length && (!data.total || pageNo * 20 < Number(data.total))
      ? '<button class="button-outline" type="button" data-action="search-page" data-page="' + (pageNo + 1) + '">下一页 →</button>'
      : '';
    content.innerHTML = '<div class="page-heading"><div><span class="eyebrow">SEARCH</span>'
      + '<h1>搜索结果</h1><p>“' + escapeHTML(keyword) + '” · ' + (data.total ? '约 ' + formatCount(data.total) + ' 条' : list.length + ' 条') + '</p></div></div>'
      + '<div class="search-tabs" role="tablist">' + tabs + '</div>'
      + resultsMarkup
      + (previous || next ? '<div class="detail-actions" style="justify-content:center">' + previous + next + '</div>' : '');
  }

  async function renderNewPage(kind, token) {
    const songsPage = kind === 'songs';
    const title = songsPage ? '新歌速递' : '最新专辑';
    const endpoint = songsPage ? '/new/songs?pageNo=1&pageSize=100' : '/new/albums?pageNo=1&pageSize=100';
    setContext(title, songsPage ? '/new/songs' : '/new/albums');
    const data = await api(endpoint);
    if (token !== state.renderToken) return;
    state.songLists = {};
    const list = Array.isArray(data.list) ? data.list : [];
    content.innerHTML = '<div class="page-heading"><div><span class="eyebrow">FRESH RELEASES</span>'
      + '<h1>' + title + '</h1><p>把刚刚发布的声音，放进今天的播放列表。</p></div>'
      + '<span class="detail-meta">' + list.length + ' 条内容</span></div>'
      + (songsPage ? renderSongList(list) : renderMediaCards(list, 'album'));
  }

  async function renderPlaylistsPage(route, token) {
    const type = route.query.get('type') === '2' ? '2' : '1';
    setContext('推荐歌单', '/playlists');
    const data = await api('/recommend/playlist?pageNo=1&type=' + type);
    if (token !== state.renderToken) return;
    const list = Array.isArray(data.list) ? data.list : [];
    const tabs = '<div class="segmented-tabs">'
      + '<button class="segment-tab' + (type === '1' ? ' is-active' : '') + '" type="button" data-action="playlist-kind" data-type="1">为你推荐</button>'
      + '<button class="segment-tab' + (type === '2' ? ' is-active' : '') + '" type="button" data-action="playlist-kind" data-type="2">最新创建</button></div>';
    content.innerHTML = '<div class="page-heading"><div><span class="eyebrow">PLAYLISTS</span>'
      + '<h1>找一张合拍的歌单</h1><p>从熟悉的旋律出发，也给新声音一点机会。</p></div></div>'
      + tabs + renderMediaCards(list, 'playlist');
  }

  function renderFavorites() {
    setContext('我喜欢的', '/favorites');
    state.songLists = {};
    content.innerHTML = '<div class="page-heading"><div><span class="eyebrow">YOUR COLLECTION</span>'
      + '<h1>我喜欢的</h1><p>收藏会保存在这台设备的浏览器中。</p></div>'
      + '<span class="detail-meta">' + state.favorites.length + ' 首歌曲</span></div>'
      + renderSongList(state.favorites);
  }

  async function renderAlbum(id, token) {
    setContext('专辑', '');
    const data = await api('/album?id=' + encodeURIComponent(id));
    if (token !== state.renderToken) return;
    state.songLists = {};
    const songs = Array.isArray(data.songList) ? data.songList : [];
    const listId = registerSongs(songs);
    content.innerHTML = '<section class="detail-hero">'
      + imageMarkup(data.picUrl, 'detail-cover', data.name || '专辑封面')
      + '<div class="detail-copy"><span class="eyebrow">ALBUM</span><h1>' + escapeHTML(data.name || '未命名专辑') + '</h1>'
      + '<p>' + artistMarkup(data.artists) + '</p>'
      + '<div class="detail-meta"><span>' + escapeHTML(data.publishTime || '发行时间未知') + '</span>'
      + '<span>' + escapeHTML(data.company || '发行公司未知') + '</span><span>' + songs.length + ' 首歌曲</span></div>'
      + '<div class="detail-actions"><button class="button-dark" type="button" data-action="play-list" data-list="' + listId + '">▶　播放全部</button></div>'
      + '</div></section>'
      + (data.desc ? '<section class="content-section"><div class="section-heading"><div><h2>专辑介绍</h2></div></div><p class="detail-description">' + escapeHTML(data.desc) + '</p></section>' : '')
      + renderSection('曲目列表', '按专辑顺序播放', renderSongList(songs), '');
  }

  async function renderSinger(id, token) {
    setContext('歌手', '');
    const encodedId = encodeURIComponent(id);
    const results = await Promise.all([
      settleApi('/singer/desc?id=' + encodedId),
      settleApi('/singer/songs?id=' + encodedId + '&pageNo=1'),
      settleApi('/singer/albums?id=' + encodedId + '&pageNo=1'),
    ]);
    if (token !== state.renderToken) return;
    state.singerView = {
      id: id,
      pageNo: 1,
      songs: results[1].data && results[1].data.list || [],
      totalPage: Number(results[1].data && results[1].data.totalPage) || 1,
      loading: false,
    };
    state.singerResults = results;
    renderSingerContent(results);
  }

  function renderSingerContent(results) {
    const profile = results[0].data;
    const songs = state.singerView ? state.singerView.songs : [];
    const albums = results[2].data && results[2].data.list || [];
    state.songLists = {};
    const listId = registerSongs(songs);
    const profileMarkup = profile
      ? '<section class="detail-hero">'
        + imageMarkup(profile.picUrl, 'profile-cover', profile.name || '歌手头像')
        + '<div class="detail-copy"><span class="eyebrow">ARTIST</span><h1>' + escapeHTML(profile.name || '未知歌手') + '</h1>'
        + '<p class="detail-description">' + escapeHTML(profile.desc || '暂无歌手介绍。') + '</p>'
        + '<div class="detail-meta"><span>' + songs.length + ' 首已加载</span><span>' + albums.length + ' 张专辑</span></div>'
        + '<div class="detail-actions"><button class="button-dark" type="button" data-action="play-list" data-list="' + listId + '">▶　播放热门歌曲</button></div>'
        + '</div></section>'
      : inlineError(results[0].error || '歌手资料暂不可用');
    const songMarkup = results[1].error
      ? inlineError(results[1].error)
      : renderSongList(songs);
    const moreButton = state.singerView
      && state.singerView.totalPage > state.singerView.pageNo
      ? '<div class="detail-actions" style="justify-content:center"><button class="button-outline" type="button" data-action="load-more-singer"'
        + (state.singerView.loading ? ' disabled' : '') + '>'
        + (state.singerView.loading ? '正在加载…' : '加载更多歌曲') + '</button></div>'
      : '';
    content.innerHTML = profileMarkup
      + renderSection('歌曲', '从这位歌手的作品中继续发现', songMarkup, '')
      + moreButton
      + renderSection('专辑', '完整专辑信息与曲目', results[2].error ? inlineError(results[2].error) : renderMediaCards(albums, 'album'), '');
  }

  async function loadMoreSinger() {
    const view = state.singerView;
    if (!view || view.loading || view.totalPage <= view.pageNo) return;
    view.loading = true;
    renderSingerContent(state.singerResults);
    try {
      const data = await api('/singer/songs?id=' + encodeURIComponent(view.id) + '&pageNo=' + (view.pageNo + 1));
      view.songs = view.songs.concat(Array.isArray(data.list) ? data.list : []);
      view.pageNo += 1;
      view.totalPage = Number(data.totalPage) || view.pageNo;
      view.loading = false;
      renderSingerContent(state.singerResults);
    } catch (error) {
      view.loading = false;
      renderSingerContent(state.singerResults);
      showToast(error.message);
    }
  }

  async function renderPlaylist(id, token) {
    setContext('歌单', '');
    const data = await api('/playlist?id=' + encodeURIComponent(id));
    if (token !== state.renderToken) return;
    state.songLists = {};
    const songs = Array.isArray(data.list) ? data.list : [];
    const listId = registerSongs(songs);
    content.innerHTML = '<section class="detail-hero">'
      + imageMarkup(data.picUrl, 'detail-cover', data.name || '歌单封面')
      + '<div class="detail-copy"><span class="eyebrow">PLAYLIST</span><h1>' + escapeHTML(data.name || '未命名歌单') + '</h1>'
      + '<p>' + escapeHTML(data.desc || '收录一些值得反复聆听的歌曲。') + '</p>'
      + '<div class="detail-meta"><span>创建者：' + escapeHTML(data.creator && data.creator.name || '未知') + '</span>'
      + '<span>' + (data.songCount || songs.length) + ' 首歌曲</span><span>播放 ' + formatCount(data.playCount) + '</span></div>'
      + '<div class="detail-actions"><button class="button-dark" type="button" data-action="play-list" data-list="' + listId + '">▶　播放全部</button></div>'
      + '</div></section>'
      + renderSection('歌单曲目', '所有可播放歌曲', renderSongList(songs), '');
  }

  async function renderRoute() {
    const token = ++state.renderToken;
    const route = parseLocation();
    const path = route.path;
    state.songLists = {};
    state.listSequence = 0;
    content.innerHTML = loadingMarkup();

    try {
      if (path === '/home' || path === '/') {
        await renderHome(token);
      } else if (path === '/search') {
        await renderSearch(route, token);
      } else if (path === '/new/songs') {
        await renderNewPage('songs', token);
      } else if (path === '/new/albums') {
        await renderNewPage('albums', token);
      } else if (path === '/playlists') {
        await renderPlaylistsPage(route, token);
      } else if (path === '/favorites') {
        renderFavorites();
      } else if (path.indexOf('/album/') === 0) {
        await renderAlbum(decodeURIComponent(path.slice('/album/'.length)), token);
      } else if (path.indexOf('/singer/') === 0) {
        await renderSinger(decodeURIComponent(path.slice('/singer/'.length)), token);
      } else if (path.indexOf('/playlist/') === 0) {
        await renderPlaylist(decodeURIComponent(path.slice('/playlist/'.length)), token);
      } else {
        throw new Error('找不到这个页面');
      }
    } catch (error) {
      if (token !== state.renderToken) return;
      content.innerHTML = '<div class="error-page"><span class="eyebrow">暂时无法打开</span>'
        + '<h1>页面加载失败</h1><p>' + escapeHTML(error.message) + '</p>'
        + '<button class="button-dark" type="button" data-action="retry">重新加载</button></div>';
    }
  }

  function toggleFavorite(song) {
    const key = songKey(song);
    if (!key) {
      showToast('这首歌曲暂时无法收藏。');
      return;
    }
    if (isFavorite(song)) {
      state.favorites = state.favorites.filter(function (item) { return songKey(item) !== key; });
      showToast('已从我喜欢的移除。');
    } else {
      state.favorites.unshift(song);
      showToast('已加入我喜欢的。');
    }
    saveStorage('migu-music:favorites', state.favorites);
    if (parseLocation().path === '/favorites') {
      renderFavorites();
    } else {
      updateFavoriteButtons();
    }
  }

  function updateFavoriteButtons() {
    document.querySelectorAll('[data-action="favorite-song"]').forEach(function (button) {
      const list = state.songLists[button.getAttribute('data-list')] || [];
      const song = list[Number(button.getAttribute('data-index'))];
      const favorite = song && isFavorite(song);
      button.classList.toggle('is-favorite', !!favorite);
      button.textContent = favorite ? '♥' : '♡';
      button.setAttribute('aria-label', favorite ? '取消收藏' : '收藏');
      button.title = favorite ? '取消收藏' : '收藏';
    });
    updatePlayer();
  }

  async function playSong(song, list, index) {
    if (!song || !(song.cid || song.copyrightId)) {
      showToast('这首歌曲暂时没有可用的版权编号。');
      return;
    }
    const token = ++state.playToken;
    state.currentSong = song;
    state.queue = Array.isArray(list) ? list : [song];
    state.queueIndex = Number(index) || 0;
    updatePlayer();
    showToast('正在获取播放链接…');

    try {
      const url = await api('/song/url?cid=' + encodeURIComponent(song.cid || song.copyrightId));
      if (token !== state.playToken) return;
      if (typeof url !== 'string' || !url) throw new Error('当前歌曲暂时没有可播放链接。');
      audio.src = url;
      audio.load();
      try {
        await audio.play();
      } catch (error) {
        if (error.name !== 'NotAllowedError') throw error;
        showToast('歌曲已就绪，点击播放按钮开始播放。');
      }
      updatePlayer();
    } catch (error) {
      if (token === state.playToken) showToast(error.message);
    }
  }

  function playList(list) {
    if (!Array.isArray(list) || !list.length) {
      showToast('这个列表里还没有可播放的歌曲。');
      return;
    }
    playSong(list[0], list, 0);
  }

  function moveQueue(direction) {
    if (!state.queue.length) {
      showToast('先选择一首歌曲。');
      return;
    }
    let next = state.queueIndex + direction;
    if (next < 0 || next >= state.queue.length) {
      if (state.repeat !== 'all') return;
      next = next < 0 ? state.queue.length - 1 : 0;
    }
    playSong(state.queue[next], state.queue, next);
  }

  function updatePlayer() {
    const song = state.currentSong;
    const title = document.getElementById('player-song-title');
    const artist = document.getElementById('player-song-artist');
    const cover = document.getElementById('player-cover');
    const playButton = document.querySelector('[data-action="toggle-play"]');
    const favoriteButton = document.querySelector('[data-action="player-favorite"]');
    const progress = document.getElementById('player-progress');
    const durationLabel = document.getElementById('player-duration');
    const currentLabel = document.getElementById('player-current-time');

    if (title) title.textContent = song && song.name || '尚未播放';
    if (artist) artist.textContent = song ? artistNames(song.artists) : '搜索或选择一首歌曲';
    if (cover) {
      const src = safeImageUrl(song && (song.picUrl || song.album && song.album.picUrl));
      cover.innerHTML = src
        ? '<img src="' + escapeHTML(src) + '" alt="" loading="lazy">'
        : '<span class="cover-note" aria-hidden="true">♪</span>';
    }
    if (playButton) {
      playButton.textContent = audio.paused ? '▶' : '| |';
      playButton.setAttribute('aria-label', audio.paused ? '播放' : '暂停');
      playButton.title = audio.paused ? '播放' : '暂停';
    }
    if (favoriteButton) {
      const favorite = song && isFavorite(song);
      favoriteButton.textContent = favorite ? '♥' : '♡';
      favoriteButton.classList.toggle('is-favorite', !!favorite);
      favoriteButton.title = favorite ? '取消收藏' : '收藏歌曲';
    }

    const duration = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(song && song.duration) || 0;
    if (progress) {
      progress.max = String(duration || 100);
      progress.value = String(Math.min(Number(audio.currentTime) || 0, duration || 100));
    }
    if (durationLabel) durationLabel.textContent = formatTime(duration);
    if (currentLabel) currentLabel.textContent = formatTime(audio.currentTime);
    updateLyricsHighlight();
  }

  function togglePlayback() {
    if (!audio.src) {
      showToast('先从歌曲列表中选择一首歌。');
      return;
    }
    if (audio.paused) {
      audio.play().catch(function (error) { showToast(error.message); });
    } else {
      audio.pause();
    }
  }

  function toggleRepeat(button) {
    state.repeat = state.repeat === 'off' ? 'all' : (state.repeat === 'all' ? 'one' : 'off');
    button.classList.toggle('is-active', state.repeat !== 'off');
    button.textContent = state.repeat === 'one' ? '↻¹' : '↻';
    button.title = state.repeat === 'one' ? '单曲循环' : (state.repeat === 'all' ? '列表循环' : '循环关闭');
    showToast(button.title);
  }

  function parseLyrics(text) {
    const lines = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      const match = line.match(/^\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)$/);
      if (!match) {
        if (line.trim()) lines.push({ time: 0, text: line.trim() });
        return;
      }
      const fraction = match[3] ? Number('0.' + match[3]) : 0;
      lines.push({
        time: Number(match[1]) * 60 + Number(match[2]) + fraction,
        text: match[4].trim(),
      });
    });
    return lines;
  }

  async function openLyrics() {
    if (!state.currentSong || !(state.currentSong.cid || state.currentSong.copyrightId)) {
      showToast('先播放一首歌曲，再查看歌词。');
      return;
    }
    lyricsModal.classList.remove('hidden');
    document.getElementById('lyrics-title').textContent = state.currentSong.name || '歌词';
    document.getElementById('lyrics-meta').textContent = artistNames(state.currentSong.artists);
    lyricsBody.innerHTML = '<div class="loading-indicator"></div>';
    try {
      const text = await api('/lyric?cid=' + encodeURIComponent(state.currentSong.cid || state.currentSong.copyrightId));
      state.lyrics = parseLyrics(text);
      if (!state.lyrics.length) {
        lyricsBody.textContent = '暂时没有找到这首歌的歌词。';
        return;
      }
      lyricsBody.innerHTML = state.lyrics.map(function (line) {
        return '<div class="lyric-line" data-time="' + line.time + '">' + escapeHTML(line.text || '　') + '</div>';
      }).join('');
      state.activeLyricIndex = -1;
      updateLyricsHighlight();
    } catch (error) {
      lyricsBody.textContent = error.message;
    }
  }

  function updateLyricsHighlight() {
    if (!state.lyrics.length || !lyricsBody) return;
    const current = Number(audio.currentTime) || 0;
    let active = 0;
    state.lyrics.forEach(function (line, index) {
      if (line.time <= current) active = index;
    });
    if (active === state.activeLyricIndex) return;
    state.activeLyricIndex = active;
    const nodes = lyricsBody.querySelectorAll('.lyric-line');
    nodes.forEach(function (node, index) {
      const isActive = index === active;
      node.classList.toggle('is-active', isActive);
      if (isActive && lyricsModal && !lyricsModal.classList.contains('hidden')) {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }

  function setSearchType(type) {
    const view = state.searchView;
    if (!view) return;
    navigate(searchRoute(view.keyword, type, 1));
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const routeButton = target.closest('[data-route]');
    if (routeButton) {
      event.preventDefault();
      navigate(routeButton.getAttribute('data-route'));
      return;
    }
    const button = target.closest('[data-action]');
    if (!button) return;

    const action = button.getAttribute('data-action');
    if (action === 'play-song' || action === 'favorite-song') {
      const list = state.songLists[button.getAttribute('data-list')] || [];
      const index = Number(button.getAttribute('data-index'));
      const song = list[index];
      if (action === 'play-song') playSong(song, list, index);
      else if (song) toggleFavorite(song);
    } else if (action === 'play-list') {
      playList(state.songLists[button.getAttribute('data-list')] || []);
    } else if (action === 'search-kind') {
      setSearchType(button.getAttribute('data-type'));
    } else if (action === 'playlist-kind') {
      navigate('/playlists?type=' + button.getAttribute('data-type'));
    } else if (action === 'search-page' && state.searchView) {
      navigate(searchRoute(state.searchView.keyword, state.searchView.type, Number(button.getAttribute('data-page'))));
    } else if (action === 'load-more-singer') {
      loadMoreSinger();
    } else if (action === 'toggle-play') {
      togglePlayback();
    } else if (action === 'previous-song') {
      if (audio.currentTime > 3) audio.currentTime = 0;
      else moveQueue(-1);
    } else if (action === 'next-song') {
      moveQueue(1);
    } else if (action === 'toggle-repeat') {
      toggleRepeat(button);
    } else if (action === 'player-favorite') {
      if (state.currentSong) toggleFavorite(state.currentSong);
      else showToast('先选择一首歌曲。');
    } else if (action === 'open-lyrics') {
      openLyrics();
    } else if (action === 'close-lyrics') {
      lyricsModal.classList.add('hidden');
    } else if (action === 'retry') {
      renderRoute();
    }
  }

  searchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const keyword = searchInput.value.trim();
    if (!keyword) {
      searchInput.focus();
      showToast('输入关键词，开始搜索。');
      return;
    }
    navigate(searchRoute(keyword, searchKind.value, 1));
  });

  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', renderRoute);
  document.getElementById('player-progress').addEventListener('input', function (event) {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(event.target.value);
    }
  });
  document.getElementById('player-volume').addEventListener('input', function (event) {
    audio.volume = Number(event.target.value);
  });
  audio.volume = Number(document.getElementById('player-volume').value);
  audio.addEventListener('timeupdate', updatePlayer);
  audio.addEventListener('loadedmetadata', updatePlayer);
  audio.addEventListener('play', updatePlayer);
  audio.addEventListener('pause', updatePlayer);
  audio.addEventListener('ended', function () {
    if (state.repeat === 'one') {
      audio.currentTime = 0;
      audio.play().catch(function (error) { showToast(error.message); });
    } else {
      moveQueue(1);
    }
  });
  audio.addEventListener('error', function () {
    showToast('播放失败，音源可能暂时不可用。');
  });
  lyricsModal.addEventListener('click', function (event) {
    if (event.target === lyricsModal) lyricsModal.classList.add('hidden');
  });

  renderRoute();
  updatePlayer();
}());
