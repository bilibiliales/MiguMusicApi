import RouteMap = Types.RouteMap;
import { getLyric } from "@util";

const Router: RouteMap = {
  async ['/']({ query }) {
    const { cid } = query;

    if (!cid) {
      return {
        result: 500,
        errMsg: 'cid呢小老弟',
      }
    }

    const lyric = await getLyric(cid);

    if (lyric) {
      return {
        result: 100,
        data: lyric,
      };
    }

    return {
      result: 200,
      errMsg: '未找到歌词',
    };
  },
}

export default Router;
