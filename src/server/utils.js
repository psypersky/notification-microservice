
//TODO: https://github.com/hiddentao/squel/issues/154 ?
function pgArr(array, cast) {
  let arrStr = JSON.stringify(array).replace('[', '{').replace(']', '}');
  if (cast) {
    arrStr = `${arrStr}::${cast}`;
  }
  return arrStr;
}

module.exports = { pgArr };