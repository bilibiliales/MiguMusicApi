import RouterMap = Types.RouteMap;
import SongInfo = Types.SongInfo;
import searchRouter from './search';
import { getBatchSong, getSongUrl, songSaver } from "@util";

const Router: RouterMap = {
  async ['/']({ query }) {
    const { cid } = query;
    if (!cid) {
      return {
        result: 500,
        errMsg: 'cid ?',
      }
    }

    let song: SongInfo = (await getBatchSong([cid]))[0];
    song = await songSaver.query(cid, song);
    const url = await getSongUrl(cid, 'HQ', song.contentId);
    return {
      result: 100,
      data: url ? {...song, url} : song,
    };
  },

  async ['/url']({ query, res }) {
    const { cid, flac = '0' ,isRedirect = '0' } = query;
    if (!cid) {
      return {
        result: 500,
        errMsg: 'cid ?',
      }
    }
    const info: SongInfo = await songSaver.query(cid);
    const url = await getSongUrl(cid, flac/1 ? 'SQ' : 'HQ', info.contentId);
    if (isRedirect/1) {
      res.redirect(url)
      return true;
    }
    return {
      result: 100,
      data: url,
    }
  },

  async ['/find']({ query, res }) {
    const { keyword, duration = 0, noMatch = '' } = query;
    if (!keyword) {
      return {
        result: 500,
        errMsg: '搜啥呢？',
      }
    }
    const noMatchArr = noMatch.split(',');
    const songRes = await searchRouter['/']({ query: { keyword }, res }).catch(() => ({}));
    // @ts-ignore
    const songList: SongInfo[] = songRes?.data?.list || [];
    let s: SongInfo | undefined;
    if (songList.length) {
      if (Number(duration)) {
        const cids = songList
          .splice(0, noMatch.length + 5)
          .filter(({ cid }) => !noMatchArr.includes(cid))
          .map(({ cid }) => cid)
          .filter((cid): cid is string => !!cid);
        const list = await getBatchSong(cids);
        const targetDuration = Number(duration);
        s = list.find(({ duration }) => duration
          && duration <= (targetDuration + 3)
          && duration >= (targetDuration - 3));
      } else {
        s = songList[0];
      }
    }
    s && s.cid && (s = await songSaver.query(s.cid, s));

    return {
      result: 100,
      data: s as SongInfo,
    }
  },
}

export default Router;