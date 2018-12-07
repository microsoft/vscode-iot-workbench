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
      value: 'CapabilityModel'
    },
    interfaceNextToken: {
      value: ''
    },
    capabilityNextToken: {
      value: ''
    },
    showSearchBar: false,
    showStatusSelector: false,
    showTagSelector: false,
    filterStatus: 'All',
    filterTags: [],
    filterKeywords: '',
    filterTagsOrAnd: 'and',
    loadingPnPInterfaces: {
      value: true
    },
    loadingPnPCapabilities: {
      value: true
    },
    allTags: {
      value: [
        'tag1',
        'tag2',
        'tag3',
        'tag11',
        'tag12',
        'tag13',
        'tag21',
        'tag22',
        'tag23',
        'tag31',
        'tag32',
        'tag33'
      ]
    },
    filterTagsKeywords: ''
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
    refreshPnPFileList,
    showHideSearchBar,
    showHideStatusSelector,
    showHideTagSelector,
    clearFilter,
    selectFilterStatus,
    addRemoveInterface,
    addRemoveCapability,
    filterItems,
    onScrollTable,
    searchTags
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
  let commandName, fileList, nextToken, loadingPnPFiles;
  
  if(fileType === 'Interface') {
    commandName = 'iotworkbench.getAllInterfaces';
    fileList = this.interfaceList;
    nextToken = this.interfaceNextToken;
    loadingPnPFiles = this.loadingPnPInterfaces;
  } else {
    commandName = 'iotworkbench.getAllCapabilities';
    fileList = this.capabilityList;
    nextToken = this.capabilityNextToken;
    loadingPnPFiles = this.loadingPnPCapabilities;
  }

  loadingPnPFiles.value = true;

  command(commandName, 50, nextToken.value, res => {
    Vue.set(fileList, 'value', fileList.value.concat(res.result.results));
    Vue.set(nextToken, 'value', res.result.continuationToken);
    Vue.set(loadingPnPFiles, 'value', false);
  });
}

function refreshPnPFileList() {
  let nextToken, selectedList;
  if(this.type.value === 'Interface') {
    fileList = this.interfaceList;
    nextToken = this.interfaceNextToken;
    selectedList = this.selectedInterfaces;
    loadingPnPFiles = this.loadingPnPInterfaces;
  } else {
    fileList = this.capabilityList;
    nextToken = this.capabilityNextToken;
    selectedList = this.selectedCapabilities;
    loadingPnPFiles = this.loadingPnPCapabilities;
  }

  Vue.set(fileList, 'value', []);
  Vue.set(nextToken, 'value', '');
  Vue.set(selectedList, 'value', []);
  Vue.set(loadingPnPFiles, 'value', true);
  setTimeout(getNextPagePnPFiles.bind(this), 1000); // wait for server refresh
}

function showHideSearchBar() {
  this.showSearchBar = !this.showSearchBar;
  this.showStatusSelector = false;
  this.showTagSelector = false;
}

function showHideStatusSelector() {
  this.showStatusSelector = !this.showStatusSelector;
  this.showTagSelector = false;
}

function showHideTagSelector() {
  this.showTagSelector = !this.showTagSelector;
  this.showStatusSelector = false;
}

function clearFilter() {
  this.filterTags = [];
  this.filterStatus = 'All';
  this.filterKeywords = '';
  this.showStatusSelector = false;
  this.showTagSelector = false;
}

function selectFilterStatus(status) {
  this.filterStatus = status;
  this.showStatusSelector = false;
}

function addRemoveInterface(id) {
  const index = this.selectedInterfaces.value.indexOf(id);
  if (index !== -1) {
    this.selectedInterfaces.value.splice(index, 1);
  } else {
    this.selectedInterfaces.value.push(id);
  }
}

function addRemoveCapability(id) {
  const index = this.selectedCapabilities.value.indexOf(id);
  if (index !== -1) {
    this.selectedCapabilities.value.splice(index, 1);
  } else {
    this.selectedCapabilities.value.push(id);
  }
}

function searchTags(tags) {
  const filterTagsKeywords = this.filterTagsKeywords.trim();
  if (!filterTagsKeywords) {
    return tags;
  }

  return tags.filter(tag => {
    return tag.toLowerCase().indexOf(filterTagsKeywords.toLowerCase()) !== -1;
  });
}

function filterItems(list) {
  if (!this.showSearchBar) {
    return list;
  }

  const filterKeywords = this.filterKeywords.trim();
  const filterStatus = this.filterStatus;
  const filterTags = this.filterTags;
  const filterTagsOrAnd = this.filterTagsOrAnd;

  return list.filter(item => {
    if (filterStatus !== 'All') {
      if (item.published && filterStatus!== 'Published') {
        return false;
      }
      if (!item.published && filterStatus!== 'Saved') {
        return false;
      }
    }

    if (!isMatchTags(item.tags, filterTags, filterTagsOrAnd)) {
      return false;
    }

    if (filterKeywords && item.displayName.toLowerCase().indexOf(filterKeywords.toLowerCase()) === -1) {
      return false;
    }

    return true;
  });
}

function isMatchTags(tags, selectedTags, orAnd) {
  if ((!tags || !tags.length) && selectedTags.length) {
    return false;
  }
  if (!selectedTags.length) {
    return true;
  }

  for (tag of selectedTags) {
    const index = tags.indexOf(tag);
    if (index === -1 && orAnd === 'and') {
      return false;
    }
    if (index !== -1 && orAnd === 'or') {
      return true;
    }
    if (index !== -1 && orAnd === 'and') {
      tags.splice(index, 1);
    }
  }
  
  if (orAnd === 'or') {
    return false;
  }

  if (orAnd === 'and' && !tags.length) {
    return true;
  }

  return false;
}

function onScrollTable(event) {
  //console.log(event);
}