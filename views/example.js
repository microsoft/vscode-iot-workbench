var example = new Vue({
  el: '#main',
  data: {
    version: '',
    publishDate: '',
    featuredExample: null,
    examples: [],
    blogs: []
  },
  created: function() {
    const query = parseQuery(location.href);
    const url = query.url ||
        'https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/gallery/workbench-example-devkit-v2.json';
    httpRequest(url, function(data) {
      var examples = [];
      var aside = [];
      try {
        if (data) {
          data = JSON.parse(data);
          examples = data.examples;
          aside = data.aside || [];
        }
      } catch(error) {
        // ignore
      }

      if (aside.length) {
        generateAside(aside);
      } else {
        document.getElementById('main').className = 'no-aside';
      }
      
      for (var i = 0; i < examples.length; i++) {
        if (examples[i].featured && !this.featuredExample) {
          this.featuredExample = examples.splice(i, 1)[0];
          i--;
        } else if (examples[i].description && examples[i].description.length > 80) {
          examples[i].description = examples[i].description.substr(0, 77) + '...';
        }
      }
      this.examples = examples;
    }.bind(this));
  },
  methods: {
    getProjectName: function(example) {
      if (example.project_name) {
        return example.project_name;
      }
    
      if (example.name) {
        let project_name = example.name.replace(/[^a-z0-9]/ig, '_').toLowerCase();
        return project_name;
      }
    
      return 'example_' + new Date().getTime();
    },
    callAPI: function(name, url) {
      var apiUrl = `/api/example?name=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`;
      httpRequest(apiUrl);
    },
    openLink: openLink
  }
});

function openLink(url) {
  if (!url) {
    return;
  }
  var apiUrl = `/api/link?url=${url}`;
  httpRequest(apiUrl);
}

function httpRequest(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        if (callback) {
          callback(xhr.responseText);
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

function parseQuery(url) {
  if (url.indexOf('?') < 0) {
    return {};
  }
  const query = url.split('?')[1].split('&');
  let res = {};
  query.forEach(q => {
    const item = q.split('=');
    res[item[0]] = item[1] ? decodeURIComponent(item[1]) : undefined;
  });

  return res;
}

function generateSection(obj, className) {
  let section = document.createElement('div');
  section.className = 'section';
  if (className) {
    section.className += ' ' + className;
  }

  if (obj.title) {
    let title = document.createElement('h1');
    title.innerText = obj.title;
    section.appendChild(title);
  }
  return section;
}

function generateLinks(obj) {
  let section = generateSection(obj, 'quick-links');
  if (obj.items && obj.items.length) {
    let ulEl = document.createElement('ul');
    ulEl.className = 'links';
    obj.items.forEach((link) => {
      let linkEl = document.createElement('li');
      linkEl.innerText = link.text;
      linkEl.addEventListener('click', () => {
        openLink(link.url);
      });
      ulEl.appendChild(linkEl);
    });
    section.appendChild(ulEl);
  }
  return section;
}

function generateTable(obj) {
  let section = generateSection(obj, 'info');
  if (obj.rows && obj.rows.length) {
    let tableEl = document.createElement('table');
    obj.rows.forEach((row) => {
      if (row.length) {
        let trEl = document.createElement('tr');
        row.forEach((col) => {
          let tdEl = document.createElement('td');
          tdEl.innerText = col.text;
          if (col.url) {
            tdEl.className = 'link';
            tdEl.addEventListener('click', () => {
              openLink(col.url);
            });
          }
          trEl.appendChild(tdEl);
        });
        tableEl.appendChild(trEl);
      }
    });
    section.appendChild(tableEl);
  }
  return section;
}

function generateText(obj) {
  let section = generateSection(obj);
  let pEl = document.createElement('p');
  pEl.innerText = obj.text;
  section.appendChild(pEl);
  return section;
}

function generateImage(obj) {
  let section = generateSection(obj);
  let imgEl = document.createElement('img');
  imgEl.src = obj.src;
  if (obj.url) {
    imgEl.className = 'link';
    imgEl.addEventListener('click', () => {
      openLink(obj.url);
    });
  }
  section.appendChild(imgEl);
  return section;
}

function generateBadge(obj) {
  let section = generateSection(obj, 'badge');
  if (obj.items && obj.items.length) {
    obj.items.forEach((item) => {
      let spanEl = document.createElement('span');
      spanEl.className = item.icon;
      spanEl.innerText = item.text;
      if (item.url) {
        spanEl.className += ' link';
        spanEl.addEventListener('click', () => {
          openLink(item.url);
        });
      }
      section.appendChild(spanEl);
    });
  }
  return section;
}

function generateFeed(obj) {
  let section = generateSection(obj, 'blog');
  httpRequest('/api/feed?url=' + encodeURIComponent(obj.url), function(data) {
    let parser = new DOMParser();
    let xmlDoc = parser.parseFromString(data,'text/xml');
    let items = xmlDoc.getElementsByTagName('item');
    let ulEl = document.createElement('ul');
    ulEl.className = 'blog';
    for (let i = 0; i < Math.min(items.length, 3); i++) {
      let title = items[i].getElementsByTagName('title')[0].textContent;
      let link = items[i].getElementsByTagName('link')[0].textContent;
      let date = new Date(items[i].getElementsByTagName('pubDate')[0].textContent).toISOString().slice(0, 10);
      let description = items[i].getElementsByTagName('description')[0].textContent;

      let liEl = document.createElement('li');
      let h2El = document.createElement('h2');
      h2El.innerText = title;
      h2El.addEventListener('click', () => {
        openLink(link);
      });
      liEl.appendChild(h2El);

      let divEl = document.createElement('div');
      divEl.className = 'date';
      divEl.innerText = date;
      liEl.appendChild(divEl);

      let pEl = document.createElement('p');
      pEl.innerText = description;
      liEl.appendChild(pEl);

      ulEl.appendChild(liEl);
    }
    section.appendChild(ulEl);
  });
  return section;
}

function generateAside(data) {
  const aside = document.getElementById('aside');

  if (data.length) {
    data.forEach(item => {
      let section;
      switch(item.type) {
        case 'links':
          section = generateLinks(item);
          break;
        case 'table':
          section = generateTable(item);
          break;
        case 'text':
          section = generateText(item);
          break;
        case 'image':
          section = generateImage(item);
          break;
        case 'badge':
          section = generateBadge(item);
          break;
        case 'feed':
          section = generateFeed(item);
          break;
        default:
          break;
      }

      if (section) {
        aside.appendChild(section);
      }
    });
  }
}