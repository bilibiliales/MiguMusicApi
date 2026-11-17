import RouteMap = Types.RouteMap;
import SongInfo = Types.SongInfo;
import ArtistInfo = Types.ArtistInfo;
import AlbumInfo = Types.AlbumInfo;
import { apiRequest } from "@util";

const HOME_PAGE_API = 'https://app.c.nf.migu.cn/pc/bmw/page-data/music-index-show/v2.0';

async function getHomeColumn(columnId: string): Promise<{ result: any, column: any }> {
  const result = await apiRequest(HOME_PAGE_API, { templateVersion: 1 });
  const contents = result.data && result.data.contents;
  const column = Array.isArray(contents)
    ? contents.find((item: any) => String(item.columnId) === columnId)
    : undefined;
  return { result, column };
}

function getArtists(names: string = ''): ArtistInfo[] {
  return String(names || '').split('|').filter(Boolean).map(name => ({ name, id: '' }));
}

const Router: RouteMap = {
  async ['/songs']({ query }) {
    const { pageNo = 1, pageSize = 10 } = query;
    const page = Math.max(1, Number(pageNo) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 10));
    const { result, column } = await getHomeColumn('75579758');
    if (result.code !== '000000') {
      return {
        result: 200,
        errMsg: result.info || '获取新歌失败',
      };
    }
    if (!column || !Array.isArray(column.contents)) {
      return {
        result: 200,
        errMsg: '新歌数据格式异常',
      };
    }

    const items = column.contents as any[];
    const list: SongInfo[] = items.slice((page - 1) * size, page * size).map(song => ({
      name: song.txt,
      id: song.songId || song.resId,
      cid: song.copyrightId,
      contentId: song.resId,
      artists: getArtists(song.txt2),
      album: {
        id: song.albumId || '',
        name: song.txt3 || '',
      },
      picUrl: song.img,
    }));

    return {
      result: 100,
      data: {
        list,
        total: items.length,
      }
    }
  },

  async ['/albums']({ query }) {
    const { pageNo = 1, pageSize = 10 } = query;
    const page = Math.max(1, Number(pageNo) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 10));
    const { result, column } = await getHomeColumn('75577835');
    if (result.code !== '000000') {
      return {
        result: 200,
        errMsg: result.info || '获取新专辑失败',
      };
    }
    if (!column || !Array.isArray(column.contents)) {
      return {
        result: 200,
        errMsg: '新专辑数据格式异常',
      };
    }

    const items = column.contents as any[];
    const list: AlbumInfo[] = items.slice((page - 1) * size, page * size).map(album => {
      const titleMatch = !album.txt2 && String(album.txt || '').match(/^([^《]+)《(.+)》$/);
      return {
        name: titleMatch ? titleMatch[2] : album.txt,
        id: album.resId || (album.logEvent && album.logEvent.resourceId) || '',
        picUrl: album.img,
        artists: getArtists(album.txt2 || (titleMatch && titleMatch[1]) || ''),
        publishTime: album.txt3,
      };
    });

    return {
      result: 100,
      data: {
        list,
        total: items.length,
      }
    }
  }
}

export default Router;
