var example = new Vue({
  el: '#example',
  data: {
    version: '',
    publishDate: '',
    featuredExample: null,
    examples: [],
    blogs: []
  },
  created: function() {
    var board = location.search ? location.search.substr(1) : 'devkit';
    httpRequest(`https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/gallery/workbench-example-${board}.json`, function(data) {
      var examples = [];
      try {
        if (data) {
          examples = JSON.parse(data);
        }
      } catch(error) {
        // ignore
      }
      
      for (var i = 0; i < examples.length; i++) {
        if (examples[i].featured && !this.featuredExample) {
          this.featuredExample = examples.splice(i, 1)[0];
          i--;
        } else if (examples[i].description.length > 80) {
          examples[i].description = examples[i].description.substr(0, 77) + '...';
        }
      }
      this.examples = examples;
    }.bind(this));

    httpRequest('/api/feed', function(data) {
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(data,'text/xml');
      var items = xmlDoc.getElementsByTagName('item');
      var blogs = [];
      for (var i = 0; i < Math.min(items.length, 3); i++) {
        var title = items[i].getElementsByTagName('title')[0].textContent;
        var link = items[i].getElementsByTagName('link')[0].textContent;
        var date = new Date(items[i].getElementsByTagName('pubDate')[0].textContent).toISOString().slice(0, 10);
        var description = items[i].getElementsByTagName('description')[0].textContent;
        blogs.push({title, link, date, description});
      }
      this.blogs = blogs;
    }.bind(this));

    httpRequest('https://raw.githubusercontent.com/VSChina/azureiotdevkit_tools/gallery/version_index_devkit.json', function(data) {
      data = JSON.parse(data);
      this.version = data.version;
      this.publishDate = data.date;
    }.bind(this));
  },
  methods: {
    getServiceImage: function(services) {
      var serviceImages = [];
      services.forEach(function (service) {
        var image = getSingleServiceImage(service);
        if (image) {
          serviceImages.push(`<img src="${image}">`);
        }
      });
      return serviceImages.join('');
    },
    callAPI: function(name, url) {
      var apiUrl = `/api/example?name=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`;
      httpRequest(apiUrl);
    },
    openLink: function(url) {
      var apiUrl = `/api/link?url=${url}`;
      httpRequest(apiUrl);
    }
  }
});

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

function getSingleServiceImage(service) {
  switch(service) {
    case 'iothub':
      return 'images/icon-iot-hub.svg';
    case 'functions':
      return 'images/icon-azure-functions.svg';
    case 'eventhub':
      return 'images/icon-event-hub.svg';
    case 'asa':
      return 'images/icon-stream-analytics.svg';
    case 'cognitive':
      return 'images/icon-cognitive-services.svg';
    case 'suite':
      return 'images/icon-azure-iot-suite.svg';
    default:
      return '';
  }
}