import RouteMap = Types.RouteMap;
import SongInfo = Types.SongInfo;
import ArtistInfo = Types.ArtistInfo;
import AlbumInfo = Types.AlbumInfo;
import MvInfo = Types.MvInfo;
import PlaylistInfo = Types.PlaylistInfo;
import { apiRequest, fullImgUrl, pickImg, toSongInfo } from '../util';

const API_HOST = 'https://app.u.nf.migu.cn/pc';

const Router: RouteMap = {
  async ['/']({ query }) {
    query.type = query.type || 'song';
    if (!query.keyword) {
      return {
        result: 500,
        errMsg: '搜啥呢？',
      }
    }

    const { keyword, pageno = 1, pageNo = pageno, pageSize = 20 } = query;

    let data: SongInfo[] | ArtistInfo[] | AlbumInfo[] | MvInfo[] | PlaylistInfo[] = [];
    let total = 0;
    switch (query.type) {
      case 'lyric':
      case 'song': {
        const res = await apiRequest(`${API_HOST}/v1.0/content/search_all.do`, {
          text: keyword,
          pageNo,
          pageSize,
          searchSwitch: '{"song":1}',
        });
        const songResult = res.songResultData || {};
        data = (songResult.result || []).map(toSongInfo);
        total = Number(songResult.totalCount) || 0;
        break;
      }
      case 'singer': {
        const res = await apiRequest(`${API_HOST}/resource/search/singer/v1.0`, {
          text: keyword,
          pageNo,
          pageSize,
        });
        data = (res.data || []).map(({ singerId, singer, imgs }: any): ArtistInfo => ({
          name: singer,
          id: singerId,
          picUrl: pickImg(imgs),
        }));
        total = data.length;
        break;
      }
      case 'album': {
        const res = await apiRequest(`${API_HOST}/bmw/album/search/v1.0`, {
          text: keyword,
          pageNo,
          pageSize,
        });
        const albumResult = res.data || {};
        data = (albumResult.result || []).map(({ id, name, singer, publishDate, imgItems }: any): AlbumInfo => ({
          name,
          id,
          artists: (singer || '').split(',').filter(Boolean).map((name: string): ArtistInfo => ({ name, id: '' })),
          publishTime: publishDate,
          picUrl: pickImg(imgItems),
        }));
        total = Number(albumResult.totalCount) || 0;
        break;
      }
      case 'playlist': {
        const res = await apiRequest(`${API_HOST}/v1.0/content/search_all.do`, {
          text: keyword,
          pageNo,
          pageSize,
          searchSwitch: '{"songlist":1}',
        });
        const listResult = res.songListResultData || {};
        data = (listResult.result || []).map(({ id, name, userId, musicNum, playNum, musicListPicUrl }: any): PlaylistInfo => ({
          name,
          id,
          picUrl: fullImgUrl(musicListPicUrl),
          songCount: Number(musicNum) || 0,
          playCount: playNum,
          creator: { id: userId },
        }));
        total = Number(listResult.totalCount) || 0;
        break;
      }
      case 'mv': {
        const res = await apiRequest(`${API_HOST}/resource/mv/search/v1.0`, {
          text: keyword,
          pageNo,
          pageSize,
        });
        const mvResult = res.data || {};
        data = (mvResult.content || []).map(({ contentId, songId, songName, singerId, singer, imgs }: any) => ({
          name: songName,
          id: songId,
          mvId: contentId,
          picUrl: pickImg(imgs),
          artists: [{ id: singerId, name: singer }],
        }));
        total = Number(mvResult.totalCount) || 0;
        break;
      }
    }

    return {
      result: 100,
      data: {
        list: data,
        total,
      },
    }
  },
}

export default Router;
