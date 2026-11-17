import RouteMap = Types.RouteMap;

const Router: RouteMap = {
  async ['/']({ res }) {
    res.render('index', { title: '音乐空间' });
    return true;
  }
}

export default Router;
