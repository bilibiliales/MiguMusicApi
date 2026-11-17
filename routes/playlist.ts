import RouteMap = Types.RouteMap;
import SongInfo = Types.SongInfo;
import { apiRequest, fullImgUrl } from "@util";

const API_HOST = 'https://app.c.nf.migu.cn';
const SONG_PAGE_SIZE = 20;

const Router: RouteMap = {
  async ['/']({ query }) {
    const { id } = query;
    if (!id) {
      return {
        result: 500,
        errMsg: 'id ?',
      };
    }

    const infoResult = await apiRequest(`${API_HOST}/MIGUM2.0/v1.0/content/resourceinfo.do`, {
      needSimple: '00',
      resourceType: 2021,
      resourceId: id,
    });
    const listInfo = Array.isArray(infoResult.resource) ? infoResult.resource[0] : undefined;
    if (infoResult.code !== '000000' || !listInfo) {
      return {
        result: 200,
        errMsg: infoResult.info || '歌单不存在或服务异常',
      };
    }

    const getSongPage = (pageNo: number): Promise<any> => apiRequest(
      `${API_HOST}/MIGUM3.0/resource/playlist/song/v2.0`,
      { pageNo, pageSize: SONG_PAGE_SIZE, playlistId: id },
    );

    const firstPage = await getSongPage(1);
    if (firstPage.code !== '000000' || !firstPage.data || !Array.isArray(firstPage.data.songList)) {
      return {
        result: 200,
        errMsg: firstPage.info || '获取歌单歌曲失败',
      };
    }

    const total = Number(firstPage.data.totalCount) || firstPage.data.songList.length;
    const pageCount = Math.ceil(total / SONG_PAGE_SIZE);
    const otherPages = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => getSongPage(index + 2)),
    );
    const failedPage = otherPages.find(page => (
      page.code !== '000000' || !page.data || !Array.isArray(page.data.songList)
    ));
    if (failedPage) {
      return {
        result: 200,
        errMsg: failedPage.info || '获取歌单歌曲失败',
      };
    }

    const songs = [
      ...firstPage.data.songList,
      ...otherPages.reduce((list: any[], page: any) => list.concat(page.data.songList), []),
    ];
    const list: SongInfo[] = songs.map(song => ({
      id: song.songId || song.contentId,
      cid: song.copyrightId,
      contentId: song.contentId,
      name: song.songName,
      artists: (song.singerList || []).map((singer: any) => ({
        id: singer.id || '',
        name: singer.name || '',
      })),
      album: {
        id: song.albumId || '',
        name: song.album || '',
        picUrl: fullImgUrl(song.img1 || song.img2 || ''),
      },
      picUrl: fullImgUrl(song.img1 || song.img2 || ''),
      duration: Number(song.duration) || 0,
      mvCid: song.mvCopyright,
    }));

    const opNumItem = listInfo.opNumItem || {};
    return {
      result: 100,
      data: {
        name: listInfo.title,
        id: listInfo.musicListId,
        picUrl: fullImgUrl(
          (listInfo.imgItem && listInfo.imgItem.img) || listInfo.originalImgUrl || '',
        ),
        playCount: opNumItem.playNum,
        songCount: total,
        trackCount: total,
        desc: listInfo.summary,
        creator: {
          id: listInfo.ownerId,
          name: listInfo.ownerName || '',
        },
        createTime: listInfo.createTime,
        updateTime: listInfo.publishTime,
        tagLists: listInfo.tags || [],
        list,
      },
    };
  },
}

export default Router;
