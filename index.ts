/// <reference path="./util/type.ts" />
import RouteMap = Types.RouteMap;
import albumRouter from './routes/album';
import indexRouter from './routes/index';
import lyricRouter from './routes/lyric';
import newRouter from './routes/new';
import playlistRouter from './routes/playlist';
import recommendRouter from './routes/recommend';
import searchRouter from './routes/search';
import singerRouter from './routes/singer';
import songRouter from './routes/song';

const routers: { [name: string]: RouteMap } = {
  album: albumRouter,
  index: indexRouter,
  lyric: lyricRouter,
  new: newRouter,
  playlist: playlistRouter,
  recommend: recommendRouter,
  search: searchRouter,
  singer: singerRouter,
  song: songRouter,
};

function parseQuery(query: string): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  query.replace(/^\?/, '').split('&').filter(Boolean).forEach((item) => {
    const separator = item.indexOf('=');
    const key = separator < 0 ? item : item.slice(0, separator);
    const value = separator < 0 ? '' : item.slice(separator + 1);
    result[decodeURIComponent(key.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
  });
  return result;
}

export default async function miguMusic(
  route: string,
  params: string | { [key: string]: any } = {},
  res?: Types.ResType,
): Promise<any> {
  const routeParts = route.replace(/^\/+|\/+$/g, '').split('/');
  const router = routers[routeParts[0]];
  if (!router) {
    throw new Error(`Unknown API route: ${routeParts[0]}`);
  }

  const path = routeParts.length > 1 ? `/${routeParts.slice(1).join('/')}` : '/';
  const handler = router[path];
  if (!handler) {
    throw new Error(`Unknown API endpoint: ${route}`);
  }

  let redirectUrl = '';
  const response: Types.ResType = res || {
    redirect(url: string) {
      redirectUrl = url;
    },
    render() {},
  };
  const query = typeof params === 'string' ? parseQuery(params) : params || {};
  const result = await handler({ query, res: response });
  return redirectUrl || result;
}
