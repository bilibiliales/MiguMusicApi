const miguMusic = require('.').default;

miguMusic('search', { keyword: '周杰伦' })
  .then((result) => {
    if (
      result.result !== 100
      || !result.data
      || !Array.isArray(result.data.list)
      || result.data.list.length === 0
    ) {
      throw new Error(`search returned no results: ${JSON.stringify(result)}`);
    }

    console.log(`(${result.data.list.length})`);
  })
  .catch((err) => {
    console.error('error: ', err.message);
    process.exitCode = 1;
  });