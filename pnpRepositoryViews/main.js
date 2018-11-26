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
    getAllPnPFiles
  },
  created: function() {
    this.companyName = this.getCompanyName();
    getAllPnPFiles.call(this, 'Interface');
    getAllPnPFiles.call(this, 'CapabilityModel');
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

function getAllPnPFiles(fileType) {
  fileType = typeof fileType === 'string' ? fileType : this.type.value;
  let commandName, fileList, selectedList;
  
  if(fileType === 'Interface') {
    commandName = 'iotworkbench.getAllInterfaces';
    fileList = this.interfaceList;
    selectedList = this.selectedInterfaces;
  } else {
    commandName = 'iotworkbench.getAllCapabilities';
    fileList = this.capabilityList;
    selectedList = this.selectedCapabilities;
  }

  command(commandName, res => {
    Vue.set(fileList, 'value', res.result);
    Vue.set(selectedList, 'value', []);
  });
}

function refreshPnPFileList() {
  setTimeout(getAllPnPFiles.bind(this), 1000); // wait for server refresh
}