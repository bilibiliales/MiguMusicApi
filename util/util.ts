import SongInfo = Types.SongInfo;
import ArtistInfo = Types.ArtistInfo;
import request from './request';

// 咪咕新版接口（app.u.nf.migu.cn 等）要求带 H5 客户端标识
const API_HEADERS = {
  platform: 'H5',
  version: '6.8.8',
  channel: '014X031',
  subchannel: '014X031',
  appId: 'h5',
  signature: '1',
  birth: 'h5page',
  referer: 'https://music.migu.cn/',
};

// signature: 1 时，响应体被一层位移加密包裹，明文在 4 字节头（ab cd 01 + 随机数）之后
const ENCODE_KEY = 'Jk8qzuePiJ1qE3mDYhLQ3T73DtDoAhLP';

const CONTENT_HOST = 'https://c.musicapp.migu.cn';
const STRATEGY_HOST = 'https://c.musicapp.migu.cn';
const IMG_HOST = 'https://d.musicapp.migu.cn';

export function decodeEnvelope(data: Buffer | string): any {
  const buf: Buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'binary');
  if (buf.length < 4 || buf[0] !== 0xab || buf[1] !== 0xcd) {
    return JSON.parse(buf.toString('utf8'));
  }
  const random: number = buf[3];
  const plain: Buffer = Buffer.alloc(buf.length - 4);
  for (let i = 4; i < buf.length; i++) {
    plain[i - 4] = (buf[i] + random - ENCODE_KEY.charCodeAt((i - 4) % ENCODE_KEY.length)) & 0xff;
  }
  return JSON.parse(plain.toString('utf8'));
}

export async function apiRequest(
  url: string,
  data: object = {},
  preserveEmptyQuery: boolean = false,
): Promise<any> {
  const raw = await request(
    { url, data, headers: API_HEADERS, responseType: 'arraybuffer', preserveEmptyQuery },
    { dataType: 'raw' },
  );
  try {
    return decodeEnvelope(raw);
  } catch (err: any) {
    throw new Error(`Failed to decode Migu API response: ${err.message}`);
  }
}

export function fullImgUrl(img: string = ''): string {
  return img.startsWith('/') ? `${IMG_HOST}${img}` : img;
}

export function pickImg(imgs: any[] = [], sizeType: string = '01'): string {
  const img: any = (imgs || []).find(({ imgSizeType }) => imgSizeType === sizeType) || (imgs || [])[0] || {};
  return fullImgUrl(img.img || '');
}

export function toDuration(length: string = '00:00:00'): number {
  return (length || '00:00:00').split(':').reduce((t, v, i) => t + Number(v) * Math.pow(60, 2 - i), 0);
}

export async function getSongDetail(cid: string): Promise<any> {
  const res = await apiRequest(`${CONTENT_HOST}/MIGUM2.0/v1.0/content/resourceinfo.do`, {
    copyrightId: cid,
    resourceType: 2,
  });
  return (res.resource || [])[0] || {};
}

// 试听的直链是带签名且有时效的，只取用，不落缓存
export async function getSongUrl(cid: string, toneFlag: string = 'PQ', contentId: string = ''): Promise<string> {
  const realContentId = contentId || (await getSongDetail(cid)).contentId;
  if (!realContentId) {
    throw new Error(`Migu did not return a content ID for ${cid}`);
  }
  // 高品质需要登录态，拿不到时退回普通品质
  const flags = toneFlag === 'PQ' ? ['PQ'] : [toneFlag, 'PQ'];
  const failures: string[] = [];
  for (const flag of flags) {
    const res = await apiRequest(`${STRATEGY_HOST}/strategy/listen-url/h5/v2.4`, {
      contentId: realContentId,
      copyrightId: cid,
      resourceType: 2,
      netType: '01',
      toneFlag: flag,
      lowerQualityContentId: realContentId,
    });
    if (res.data && res.data.url) {
      return res.data.url;
    }
    const details = [
      res.code && `code=${res.code}`,
      (res.info || res.message || res.msg) && `message=${res.info || res.message || res.msg}`,
      res.data && res.data.dialogInfo && res.data.dialogInfo.text
        && `dialog=${res.data.dialogInfo.text}`,
    ].filter(Boolean);
    failures.push(`${flag}: ${details.join(', ') || 'no URL in response'}`);
  }

  for (const flag of flags) {
    const res = await apiRequest(
      'https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0',
      {
        scene: '',
        netType: '01',
        resourceType: 2,
        copyrightId: cid,
        contentId: realContentId,
        toneFlag: flag,
      },
      true,
    );
    if (res.data && res.data.url) {
      return res.data.url;
    }
    const details = [
      res.code && `code=${res.code}`,
      (res.info || res.message || res.msg) && `message=${res.info || res.message || res.msg}`,
      res.data && res.data.dialogInfo && res.data.dialogInfo.text
        && `dialog=${res.data.dialogInfo.text}`,
    ].filter(Boolean);
    failures.push(`PC ${flag}: ${details.join(', ') || 'no URL in response'}`);
  }

  throw new Error(`Migu did not return a playable URL for ${cid} (${failures.join('; ')})`);
}

export async function getLyric(cid: string, lrcUrl: string = ''): Promise<string> {
  const url = lrcUrl || (await getSongDetail(cid)).lrcUrl;
  if (!url) {
    return '';
  }
  const lyric = await request({ url, headers: { referer: API_HEADERS.referer } }, { dataType: 'raw' });
  return typeof lyric === 'string' ? lyric : '';
}

export function toSongInfo(song: any): SongInfo {
  const mv: any = (song.mvList || [])[0] || {};
  const album: any = (song.albums || [])[0] || {};
  return {
    name: song.name,
    id: song.id,
    cid: song.copyrightId,
    contentId: song.contentId,
    mvId: mv.id,
    mvCid: mv.copyrightId,
    album: {
      picUrl: pickImg(song.imgItems),
      name: album.name || '',
      id: album.id || '',
    },
    artists: (song.singers || []).map(({ id, name }: any): ArtistInfo => ({ id, name })),
  };
}

export function toResourceSongInfo(song: any): SongInfo {
  const picUrl = fullImgUrl(song.img1 || song.img2 || '');
  return {
    name: song.songName,
    id: song.songId || song.contentId,
    cid: song.copyrightId,
    contentId: song.contentId,
    mvId: song.mvId,
    album: {
      id: song.albumId || '',
      name: song.album || '',
      picUrl,
    },
    artists: (song.singerList || []).map(({ id, name }: any): ArtistInfo => ({
      id: id || '',
      name: name || '',
    })),
    picUrl,
    duration: Number(song.duration) || 0,
  };
}

export function getQueryFromUrl(key?: string | null, search: string = ''): any {
  try {
    const sArr: string[] = search.split('?');
    let s: string = '';
    if (sArr.length > 1) {
      s = sArr[1];
    } else {
      return key ? undefined : {};
    }
    const querys: string[] = s.split('&');
    const result: object = {};
    querys.forEach((item: string): void => {
      const temp: string[] = item.split('=');
      result[temp[0]] = decodeURIComponent(temp[1]);
    });
    return key ? result[key] : result;
  } catch (err) {
    // 除去search为空等异常
    return key ? '' : {};
  }
}

export function changeUrlQuery(
  obj: object,
  baseUrl: string = '',
  preserveEmpty: boolean = false,
): string {
  const query: object = getQueryFromUrl(null, baseUrl);
  let url: string = baseUrl.split('?')[0];

  const newQuery: object = {...query, ...obj};
  let queryArr: string[] = [];
  Object.keys(newQuery).forEach((key: string): void => {
    if (newQuery[key] !== undefined && (preserveEmpty || newQuery[key] !== '')) {
      queryArr.push(`${key}=${encodeURIComponent(newQuery[key])}`);
    }
  });
  return `${url}?${queryArr.join('&')}`.replace(/\?$/, '');
}

export function getId(url: string = '/'): string {
  return url.match(/\/([^\/]+)$/)?.[1] || '';
}

export async function getBatchSong(cids: string[] = []): Promise<SongInfo[]> {
  const details = await Promise.all(cids.map((cid: string): Promise<any> => getSongDetail(cid)));

  return details.filter(({ copyrightId }) => copyrightId).map((data: any): SongInfo => ({
    id: data.songId,
    cid: data.copyrightId,
    contentId: data.contentId,
    name: data.songName,
    artists: data.artists || [],
    album: {
      id: data.albumId,
      name: data.album,
      picUrl: pickImg(data.albumImgs),
    },
    duration: toDuration(data.length),
    mvCid: data.mvCopyright,
  }))
}