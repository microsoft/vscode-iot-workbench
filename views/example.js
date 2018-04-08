var example = new Vue({
  el: '#example',
  data: {
    examples: []
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
      console.log(this)
      this.examples = examples;
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