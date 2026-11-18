import jsonFile from 'jsonfile';
import { getSongDetail, getLyric, pickImg, toDuration } from './util';
import SongInfo = Types.SongInfo;

class SongSaver {
  constructor() {
    jsonFile.readFile('data/songUrl.json')
      .then((res) => {
        this.data = res;
      }).catch(() => {
        this.data = {}
    });
  }

  private data: {
    [propName: string]: SongInfo,
  } = {};

  push(id: string, info: SongInfo): void {
    this.data[id] = info;
  }

  get(id: string): SongInfo | undefined {
    return this.data[id];
  }

  async query(cid:string, data:SongInfo | undefined = {}): Promise<SongInfo> {
    try {
      const info = this.get(cid);
      if (info && info.contentId) {
        const newInfo = {...info, ...data}
        this.push(cid, newInfo)
        return newInfo;
      }

      const obj: SongInfo = {...info, ...data};

      if (!obj.picUrl || !obj.contentId) {
        const detail = await getSongDetail(cid);
        if (detail.contentId) {
          obj.picUrl = pickImg(detail.albumImgs);
          obj.bigPicUrl = pickImg(detail.albumImgs, '03') || obj.picUrl;
          obj.cid = cid;
          obj.contentId = detail.contentId;
          obj.id = detail.songId;
          obj.name = detail.songName;
          obj.artists = detail.artists;
          obj.album = {
            id: detail.albumId,
            name: detail.album,
            picUrl: obj.picUrl,
          };
          obj.duration = toDuration(detail.length);

          detail.lrcUrl && (obj.lyric = await getLyric(cid, detail.lrcUrl))
        }
      }

      this.push(cid, obj);
      this.write();
      return obj;
    } catch (err) {
      console.log(err);
      return data;
    }
  }

  write() {
    jsonFile.writeFile('data/songUrl.json', this.data).catch(() => {});
  }
}

export default new SongSaver();