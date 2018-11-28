var repository = new Vue({
  el: '#main',
  data: {
    companyName: '',
    selectedInterfaces: {
      value: []
    },
    interfaceList: {
      value: []
    },
    selectedCapabilities: {
      value: []
    },
    capabilityList: {
      value: []
    },
    type: {
      value: 'Interface'
    },
    interfaceNextToken: {
      value: ''
    },
    capabilityNextToken: {
      value: ''
    }
  },
  methods: {
    command,
    getCompanyName: () => {
      return 'Contoso Inc.';
    },
    createPnPFile,
    deletePnPFiles,
    editPnPFiles,
    publishPnPFiles,
    getNextPagePnPFiles,
    refreshPnPFileList
  },
  created: function() {
    this.companyName = this.getCompanyName();
    getNextPagePnPFiles.call(this, 'Interface');
    getNextPagePnPFiles.call(this, 'CapabilityModel');
  }
});


function deletePnPFiles() {
  const fileIds = this.type.value === 'Interface' ? this.selectedInterfaces.value : this.selectedCapabilities.value;
  command('iotworkbench.deletePnPFiles', fileIds, this.type.value, refreshPnPFileList.bind(this));
}

function editPnPFiles() {
  const fileIds = this.type.value === 'Interface' ? this.selectedInterfaces.value : this.selectedCapabilities.value;
  command('iotworkbench.editPnPFiles', fileIds, this.type.value, refreshPnPFileList.bind(this));
}

function publishPnPFiles() {
  const fileIds = this.type.value === 'Interface' ? this.selectedInterfaces.value : this.selectedCapabilities.value;
  command('iotworkbench.publishPnPFiles', fileIds, this.type.value, refreshPnPFileList.bind(this));
}

function createPnPFile() {
  const commandName = this.type.value === 'Interface' ? 'iotworkbench.createPnPInterface' : 'iotworkbench.createPnPCapabilityModel';
  command(commandName);
}

function getNextPagePnPFiles(fileType) {
  fileType = typeof fileType === 'string' ? fileType : this.type.value;
  let commandName, fileList, nextToken;
  
  if(fileType === 'Interface') {
    commandName = 'iotworkbench.getAllInterfaces';
    fileList = this.interfaceList;
    nextToken = this.interfaceNextToken;
  } else {
    commandName = 'iotworkbench.getAllCapabilities';
    fileList = this.capabilityList;
    nextToken = this.capabilityNextToken;
  }

  command(commandName, 50, nextToken.value, res => {
    Vue.set(fileList, 'value', fileList.value.concat(res.result.results));
    Vue.set(nextToken, 'value', res.result.continuationToken);
  });
}

function refreshPnPFileList() {
  let nextToken, selectedList;
  if(this.type.value === 'Interface') {
    fileList = this.interfaceList;
    nextToken = this.interfaceNextToken;
    selectedList = this.selectedInterfaces;
  } else {
    fileList = this.capabilityList;
    nextToken = this.capabilityNextToken;
    selectedList = this.selectedCapabilities;
  }

  Vue.set(fileList, 'value', []);
  Vue.set(nextToken, 'value', '');
  Vue.set(selectedList, 'value', []);
  setTimeout(getNextPagePnPFiles.bind(this), 1000); // wait for server refresh
}