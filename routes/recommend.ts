import RouteMap = Types.RouteMap;
import request from "@request";

const API_URL = 'https://app.c.nf.migu.cn/MIGUM2.0/v2.0/content/getMusicData.do';

const Router: RouteMap = {
  async ['/playlist']({ query }) {
    const { pageNo = 1, pageSize = 10, type = 1 } = query;
    const page = Math.max(1, Number(pageNo) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 10));
    const playlistType = Number(type);
    if (playlistType !== 1 && playlistType !== 2) {
      return {
        result: 500,
        errMsg: 'type 只能为 1 或 2',
      };
    }

    const result = await request({
      url: API_URL,
      data: {
        start: page,
        count: size,
        templateVersion: 5,
        type: playlistType,
      },
      headers: {
        referer: 'https://music.migu.cn/',
      },
    });
    if (result.code !== '000000') {
      return {
        result: 200,
        errMsg: result.info || '获取推荐歌单失败',
      };
    }

    const groupId = playlistType === 1 ? 'recommended_group' : 'latest_group';
    const groups = result.data && result.data.contentItemList;
    const group = Array.isArray(groups) && groups.find((item: any) => item.id === groupId);
    if (!group || !Array.isArray(group.itemList)) {
      return {
        result: 200,
        errMsg: '推荐歌单数据格式异常',
      };
    }

    const list: Types.PlaylistInfo[] = group.itemList.map((item: any) => {
      const match = String(item.actionUrl || '').match(/[?&]id=(\d+)/);
      return {
        name: item.title,
        id: match ? match[1] : '',
        picUrl: item.imageUrl || '',
        playCount: item.barList && item.barList[0] && item.barList[0].title,
        creator: {
          name: item.subTitle || '',
        },
      };
    }).filter((item: Types.PlaylistInfo) => item.id && item.name);

    return {
      result: 100,
      data: {
        list,
        total: list.length,
      }
    }
  }
}

export default Router;
