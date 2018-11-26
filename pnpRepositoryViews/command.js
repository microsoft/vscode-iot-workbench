function command(cmd, callback) {
  if (!cmd) {
    return;
  }
  let args = Array.from(arguments);
  if (typeof args[args.length - 1] === 'function') {
    callback = args[args.length - 1];
    args.length = args.length - 1;
  } else {
    callback = undefined;
  }
  const data = encodeURIComponent(JSON.stringify(args));
  const url = `/command?data=${data}`;
 
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        if (callback) {
          callback(JSON.parse(xhr.responseText));
        }
      } else {
        if (callback) {
          callback(null);
        }
      }
    }
  }
  xhr.open('GET', url, true);
  xhr.send();
}