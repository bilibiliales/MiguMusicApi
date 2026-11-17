# MiguMusicApi

[![NPM](https://img.shields.io/npm/v/migu-music-api.svg)](https://www.npmjs.com/package/migu-music-api)
[![github](https://img.shields.io/badge/github-MiguMusicApi-brightgreen.svg)](https://github.com/jsososo/MiguMusicApi)
[![GitHub Pages Star](https://img.shields.io/github/stars/jsososo/MiguMusicApi.svg)](https://github.com/jsososo/MiguMusicApi)


接口参考：

[接口文档 Github](https://jsososo.github.io/MiguMusicApi/#/)


## 快速上手

### Node 服务

```shell script
git clone git@github.com:jsososo/MiguMusicApi.git

npm install

npm start
```

启动后打开 `http://localhost:3400`，即可使用在线音乐页面搜索歌曲、歌手、专辑和歌单，播放歌曲、查看歌词并保存本机收藏。页面使用本项目的同源 API；接口文档可从页面中的“API 文档”入口打开。


### npm

```shell script
npm add migu-music-api
```

#### 接口调用

```javascript
const miguMusic = require('migu-music-api').default;
// or
// import miguMusic from 'migu-music-api';

// 部分接口依赖 cookie, 这里穿参可以使用字符串或对象
miguMusic('search', { keyword: '周杰伦' })
  .then((res) => console.log(res))
  .catch((err) => console.error('err: ', err.message));

miguMusic('search')
  .then((res) => console.log(res))
  .catch((err) => console.error('err: ', err.message));
```


