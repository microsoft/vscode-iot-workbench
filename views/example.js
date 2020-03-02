const callbackStack = [];
// eslint-disable-next-line no-undef
const vscode = acquireVsCodeApi();

const example = new Vue({
  el: "#main",
  data: {
    version: "",
    publishDate: "",
    featuredExample: null,
    officialExamples: [],
    communityExamples: [],
    blogs: [],
    boardId: ""
  },
  created: function() {
    const query = parseQuery(_location ? _location.href : location.href);
    const url =
      query.url ||
      "https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/gallery/workbench-example-devkit-v2.json";
    this.boardId = query.board || "";
    httpRequest(
      url,
      function(data) {
        let examples = [];
        let aside = [];
        try {
          if (data) {
            data = JSON.parse(data);
            examples = data.examples;
            aside = data.aside || [];
          }
        } catch (error) {
          // ignore
        }

        if (aside.length) {
          generateAside(aside);
        } else {
          document.getElementById("main").className = "no-aside";
        }

        for (let i = 0; i < examples.length; i++) {
          examples[i].fullDescription = examples[i].description;
          if (examples[i].featured && !this.featuredExample) {
            this.featuredExample = examples.splice(i, 1)[0];
            i--;
          } else if (
            examples[i].description &&
            examples[i].description.length > 80
          ) {
            examples[i].description =
              examples[i].description.substr(0, 77) + "...";
          }
        }
        this.officialExamples = examples.filter(example => !example.author);
        this.communityExamples = examples.filter(example => example.author);
      }.bind(this)
    );
  },
  methods: {
    getProjectName: function(example) {
      if (example.project_name) {
        return example.project_name;
      }

      if (example.name) {
        const projectName = example.name
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        return projectName;
      }

      return "example_" + new Date().getTime();
    },
    callAPI: function(name, url, boardId) {
      if (!name || !url) {
        command("iotworkbench.examples");
        return;
      }
      command("iotworkbench.exampleInitialize", name, url, boardId);
    },
    openLink: openLink
  }
});

function openLink(url, example) {
  if (!url) {
    return;
  }
  command("iotworkbench.openUri", url);
  if (example) {
    command("iotworkbench.sendTelemetry", { example });
  }
}

function httpRequest(url, callback) {
  command("iotworkbench.httpRequest", url, res => {
    if (res.code === 0) {
      callback(res.result);
    } else {
      callback(null);
    }
  });
}

function parseQuery(url) {
  if (url.indexOf("?") < 0) {
    return {};
  }
  const query = url.split("?")[1].split("&");
  const res = {};
  query.forEach(q => {
    const item = q.split("=");
    res[item[0]] = item[1] ? decodeURIComponent(item[1]) : undefined;
  });

  return res;
}

function generateSection(obj, className) {
  const section = document.createElement("div");
  section.className = "section";
  if (className) {
    section.className += " " + className;
  }

  if (obj.title) {
    const title = document.createElement("h1");
    title.innerText = obj.title;
    section.appendChild(title);
  }
  return section;
}

function generateLinks(obj) {
  const section = generateSection(obj, "quick-links");
  if (obj.items && obj.items.length) {
    const ulEl = document.createElement("ul");
    ulEl.className = "links";
    obj.items.forEach(link => {
      const linkEl = document.createElement("li");
      linkEl.innerText = link.text;
      linkEl.addEventListener("click", () => {
        openLink(link.url);
      });
      ulEl.appendChild(linkEl);
    });
    section.appendChild(ulEl);
  }
  return section;
}

function generateTable(obj) {
  const section = generateSection(obj, "info");
  if (obj.rows && obj.rows.length) {
    const tableEl = document.createElement("table");
    obj.rows.forEach(row => {
      if (row.length) {
        const trEl = document.createElement("tr");
        row.forEach(col => {
          const tdEl = document.createElement("td");
          tdEl.innerText = col.text;
          if (col.url) {
            tdEl.className = "link";
            tdEl.addEventListener("click", () => {
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
  const section = generateSection(obj);
  const pEl = document.createElement("p");
  pEl.innerText = obj.text;
  section.appendChild(pEl);
  return section;
}

function generateImage(obj) {
  const section = generateSection(obj);
  const imgEl = document.createElement("img");
  imgEl.src = obj.src;
  if (obj.url) {
    imgEl.className = "link";
    imgEl.addEventListener("click", () => {
      openLink(obj.url);
    });
  }
  section.appendChild(imgEl);
  return section;
}

function generateBadge(obj) {
  const section = generateSection(obj, "badge");
  if (obj.items && obj.items.length) {
    obj.items.forEach(item => {
      const spanEl = document.createElement("span");
      spanEl.className = item.icon;
      spanEl.innerText = item.text;
      if (item.url) {
        spanEl.className += " link";
        spanEl.addEventListener("click", () => {
          openLink(item.url);
        });
      }
      section.appendChild(spanEl);
    });
  }
  return section;
}

function generateFeed(obj) {
  const section = generateSection(obj, "blog");
  httpRequest(obj.url, function(data) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, "text/xml");
    const items = xmlDoc.getElementsByTagName("item");
    const ulEl = document.createElement("ul");
    ulEl.className = "blog";
    for (let i = 0; i < Math.min(items.length, 3); i++) {
      const title = items[i].getElementsByTagName("title")[0].textContent;
      const link = items[i].getElementsByTagName("link")[0].textContent;
      const date = new Date(
        items[i].getElementsByTagName("pubDate")[0].textContent
      )
        .toISOString()
        .slice(0, 10);
      const description = items[i].getElementsByTagName("description")[0]
        .textContent;

      const liEl = document.createElement("li");
      const h2El = document.createElement("h2");
      h2El.innerText = title;
      h2El.addEventListener("click", () => {
        openLink(link);
      });
      liEl.appendChild(h2El);

      const divEl = document.createElement("div");
      divEl.className = "date";
      divEl.innerText = date;
      liEl.appendChild(divEl);

      const pEl = document.createElement("p");
      pEl.innerHTML = description;
      pEl.innerText = pEl.innerText;
      liEl.appendChild(pEl);

      ulEl.appendChild(liEl);
    }
    section.appendChild(ulEl);
  });
  return section;
}

function generateAside(data) {
  const aside = document.getElementById("aside");

  if (data.length) {
    data.forEach(item => {
      let section;
      switch (item.type) {
        case "links":
          section = generateLinks(item);
          break;
        case "table":
          section = generateTable(item);
          break;
        case "text":
          section = generateText(item);
          break;
        case "image":
          section = generateImage(item);
          break;
        case "badge":
          section = generateBadge(item);
          break;
        case "feed":
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
function command(cmd, callback) {
  if (!cmd) {
    return;
  }
  const args = Array.from(arguments);
  if (typeof args[args.length - 1] === 'function') {
    callback = args[args.length - 1];
    args.length = args.length - 1;
  } else {
    callback = undefined;
  }
  args.shift();
  const messageId = new Date().getTime() + Math.random();

  callbackStack.push({
    messageId,
    callback
  });

  vscode.postMessage({
    messageId,
    command: cmd,
    parameter: args
  });
}

window.addEventListener("message", event => {
  const message = event.data;

  for (let index = 0; index < callbackStack.length; index++) {
    const callbackItem = callbackStack[index];
    if (callbackItem.messageId === message.messageId) {
      if (callbackItem.callback) {
        callbackItem.callback(message.payload);
      }
      callbackStack.splice(index, 1);
      break;
    }
  }
});
