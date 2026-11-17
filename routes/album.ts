import RouteMap = Types.RouteMap;
import SongInfo = Types.SongInfo;
import ArtistInfo = Types.ArtistInfo;
import AlbumInfo = Types.AlbumInfo;
import { apiRequest, pickImg, toResourceSongInfo } from '@util';

const API_HOST = 'https://app.c.nf.migu.cn';
const SONG_PAGE_SIZE = 100;

async function getAlbumSongs(id: string): Promise<{ list?: SongInfo[], errMsg?: string }> {
  const getPage = (pageNo: number): Promise<any> => apiRequest(
    `${API_HOST}/MIGUM3.0/resource/album/song/v2.0`,
    { albumId: id, pageNo, pageSize: SONG_PAGE_SIZE },
  );
  const firstPage = await getPage(1);
  if (firstPage.code !== '000000' || !firstPage.data || !Array.isArray(firstPage.data.songList)) {
    return { errMsg: firstPage.info || '获取专辑歌曲失败' };
  }

  const total = Number(firstPage.data.totalCount) || firstPage.data.songList.length;
  const pageCount = Math.ceil(total / SONG_PAGE_SIZE);
  const otherPages = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => getPage(index + 2)),
  );
  const failedPage = otherPages.find(page => (
    page.code !== '000000' || !page.data || !Array.isArray(page.data.songList)
  ));
  if (failedPage) {
    return { errMsg: failedPage.info || '获取专辑歌曲失败' };
  }

  const songs = [
    ...firstPage.data.songList,
    ...otherPages.reduce((list: any[], page: any) => list.concat(page.data.songList), []),
  ];
  return { list: songs.map(toResourceSongInfo) };
}

const Router: RouteMap = {
  async ['/']({ query }) {
    const { id } = query;
    if (!id) {
      return {
        result: 500,
        errMsg: 'id ?'
      }
    }
    const result = await apiRequest(`${API_HOST}/MIGUM2.0/v1.0/content/resourceinfo.do`, {
      needSimple: '00',
      resourceType: 2003,
      resourceId: id,
    });
    const album = Array.isArray(result.resource) ? result.resource[0] : undefined;
    if (result.code !== '000000' || !album) {
      return {
        result: 200,
        errMsg: result.info || '专辑不存在或服务异常',
      };
    }

    const songResult = await getAlbumSongs(id);
    if (!songResult.list) {
      return {
        result: 200,
        errMsg: songResult.errMsg || '获取专辑歌曲失败',
      };
    }

    const singerNames = String(album.singer || '').split(/[|,]/).filter(Boolean);
    const singerIds = String(album.singerId || '').split(/[|,]/);
    const artists: ArtistInfo[] = singerNames.map((name: string, index: number) => ({
      id: singerIds[index] || '',
      name,
    }));

    const data: AlbumInfo = {
      name: album.title || '',
      id: album.albumId || id,
      artists,
      company: album.publishCorp || album.publishCompany || '',
      publishTime: album.publishTime || album.publishDate || '',
      picUrl: pickImg(album.imgItems),
      desc: album.summary || '',
      songList: songResult.list,
    };

    return {
      result: 100,
      data,
    };
  },

  async ['/songs']({ query }) {
    const { id } = query;
    if (!id) {
      return {
        result: 500,
        errMsg: 'id ？'
      }
    }
    const songResult = await getAlbumSongs(id);
    if (!songResult.list) {
      return {
        result: 200,
        errMsg: songResult.errMsg || '获取专辑歌曲失败',
      };
    }

    return {
      result: 100,
      data: songResult.list,
    }
  },
}

export default Router;
