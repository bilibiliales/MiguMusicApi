import RouterMap = Types.RouteMap;
import ArtistInfo = Types.ArtistInfo;
import AlbumInfo = Types.AlbumInfo;
import SongInfo = Types.SongInfo;
import { apiRequest, pickImg, toResourceSongInfo } from '../util';

const API_HOST = 'https://app.c.nf.migu.cn';


const Router: RouterMap = {
  async ['/desc']({ query }) {
    const { id } = query;
    if (!id) {
      return {
        result: 500,
        errMsg: 'id ?'
      }
    }
    const result = await apiRequest(`${API_HOST}/MIGUM2.0/v1.0/content/resourceinfo.do`, {
      needSimple: '00',
      resourceType: 2002,
      resourceId: id,
    });
    const singer = Array.isArray(result.resource) ? result.resource[0] : undefined;
    if (result.code !== '000000' || !singer) {
      return {
        result: 200,
        errMsg: result.info || '歌手不存在或服务异常',
      };
    }
    return {
      result: 100,
      data: {
        name: singer.singer || '',
        picUrl: pickImg(singer.imgs),
        id: singer.singerId || id,
        desc: singer.summary || '',
      },
    };
  },
  async ['/songs']({ query }) {
    const { id, pageno, pageNo } = query;
    if (!id) {
      return {
        result: 500,
        errMsg: 'id ?'
      };
    }
    const page = Math.max(1, Number(pageNo || pageno) || 1);
    const result = await apiRequest(`${API_HOST}/bmw/singer/song/v1.0`, {
      singerId: id,
      pageNo: page,
      type: 1,
    });
    if (result.code !== '000000' || !result.data || !Array.isArray(result.data.contents)) {
      return {
        result: 200,
        errMsg: result.info || '获取歌手歌曲失败',
      };
    }

    const songSection = result.data.contents.find((item: any) => item.view === 'ZJ-Singer-Song-Scroll');
    if (!songSection || !Array.isArray(songSection.contents)) {
      return {
        result: 200,
        errMsg: '歌手歌曲数据格式异常',
      };
    }

    const list: SongInfo[] = songSection.contents
      .filter((item: any) => item.songItem)
      .map((item: any) => toResourceSongInfo(item.songItem));
    const nextPageUrl = result.data.header && result.data.header.nextPageUrl || '';
    const nextPage = String(nextPageUrl).match(/[?&]pageNo=(\d+)/);

    return {
      result: 100,
      data: {
        list,
        totalPage: nextPage ? Number(nextPage[1]) : page,
      }
    };
  },
  async ['/albums']({ query }) {
    const { id, pageNo = 1, pageno = pageNo } = query;
    if (!id) {
      return {
        result: 500,
        errMsg: 'id ?'
      };
    }
    const page = Math.max(1, Number(pageno) || 1);
    const result = await apiRequest(`${API_HOST}/bmw/singer/album/v1.0`, {
      singerId: id,
      pageNo: page,
    });
    if (result.code !== '000000') {
      return {
        result: 200,
        errMsg: result.info || '获取歌手专辑失败',
      };
    }

    const albums = result.data && result.data.contents;
    if (!Array.isArray(albums)) {
      return {
        result: 200,
        errMsg: '歌手专辑数据格式异常',
      };
    }

    const list: AlbumInfo[] = albums.map((album: any) => ({
      id: album.resId || '',
      picUrl: album.img,
      name: album.txt || '',
      artists: album.txt2
        ? String(album.txt2).split('|').filter(Boolean).map((name: string): ArtistInfo => ({
          id: '',
          name,
        }))
        : [],
      publishTime: album.txt3,
    }));

    const nextPageUrl = result.data.header && result.data.header.nextPageUrl || '';
    const nextPage = String(nextPageUrl).match(/[?&]pageNo=(\d+)/);

    return {
      result: 100,
      data: { list, totalPage: nextPage ? Number(nextPage[1]) : page },
    };
  },
}

export default Router;
