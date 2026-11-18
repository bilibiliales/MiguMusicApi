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

### Vercel

项目根目录已包含 Vercel 配置。导入 Git 仓库并部署即可：构建命令会运行 `npm run build`，所有请求会转发到 Express Serverless Function，原有 API 路径和网页入口保持不变。

Vercel 函数的文件系统不适合作为持久化存储，因此歌曲信息缓存不会像本地 Node 服务一样可靠地保存到 `data/songUrl.json`。


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


