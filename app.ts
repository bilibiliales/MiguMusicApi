/// <reference path="./util/type.ts" />
import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import RouterMap = Types.RouteMap;
import albumRouter from './routes/album';
import indexRouter from './routes/index';
import lyricRouter from './routes/lyric';
import newRouter from './routes/new';
import playlistRouter from './routes/playlist';
import recommendRouter from './routes/recommend';
import searchRouter from './routes/search';
import singerRouter from './routes/singer';
import songRouter from './routes/song';

const app = express();
const routers: { [name: string]: RouterMap } = {
  album: albumRouter,
  index: indexRouter,
  lyric: lyricRouter,
  new: newRouter,
  playlist: playlistRouter,
  recommend: recommendRouter,
  search: searchRouter,
  singer: singerRouter,
  song: songRouter,
};

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/docs', express.static(path.join(__dirname, 'docs')));

Object.keys(routers).reverse().forEach(filename => {
  const routeMap = routers[filename];
  Object.keys(routeMap).forEach((path: string): void => {
    let fullPah = `/${filename}${path}`;
    if (fullPah === '/index/') {
      fullPah = '/';
    }
    app.use(fullPah, (req, res, next) => {
      const router = express.Router();
      req.query = {
        ...req.query,
        ...req.body,
      };
      let routeFunc = routeMap[path];
      const func = async (req, res) => {
        const result = await routeFunc({
          query: req.query,
          res,
        }).catch((err) => ({ result: 400, errMsg: `异常：${err.message}`}))
        if (typeof result === 'object') {
          res.send(result);
        }
      };
      router.post('/', func);
      router.get('/', func);
      router(req, res, next);
    });
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
