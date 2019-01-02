import {PnPMetaModelContext} from './PnPMetaModelUtility';
import uniq = require('lodash.uniq');

export interface GraphNode {
  Id: string;
  Value?: string;
}

export interface GraphEdge {
  SourceNode: GraphNode;
  TargetNode: GraphNode;
  Label: string;
}

export interface PnPMetaModelGraph {
  Nodes: GraphNode[];
  Edges: GraphEdge[];
}

export interface Map<T> { [key: string]: T; }

export class PnPMetaModelParser {
  static LABEL = {
    DOMAIN: 'http://www.w3.org/2000/01/rdf-schema#domain',
    LABEL: 'http://www.w3.org/2000/01/rdf-schema#label',
    SUBCLASS: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    RANGE: 'http://www.w3.org/2000/01/rdf-schema#range',
    TYPE: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    COMMENT: 'http://www.w3.org/2000/01/rdf-schema#comment'
  };

  constructor(
      private graph: PnPMetaModelGraph,
      private pnpInterface: PnPMetaModelContext,
      private pnpCapabilityModel: PnPMetaModelContext) {}

  cache = {
    IdFromLabel: {} as Map<string>,
    PropertyNameFromId: {} as Map<string>,
    TypesFromId: {} as Map<string[]>
  };

  getCommentFromId(id: string): string|undefined {
    for (const edge of this.graph.Edges) {
      if (edge.SourceNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.COMMENT) {
        return edge.TargetNode.Value;
      }
    }
    return undefined;
  }

  getIdFromShortName(pnpContext: PnPMetaModelContext, shortName: string): string
      |null {
    if (pnpContext['@context'].hasOwnProperty(shortName)) {
      const shortNameValue = pnpContext['@context'][shortName];
      if (typeof shortNameValue === 'string') {
        return pnpContext['@context']['@vocab'] + shortNameValue;
      } else {
        return pnpContext['@context']['@vocab'] + shortNameValue['@id'];
      }
    } else {
      return null;
    }
  }

  getIdFromLabel(pnpContext: PnPMetaModelContext, label: string): string|null {
    return pnpContext['@context']['@vocab'] + label;
    // if (this.cache.IdFromLabel[type]) {
    //     return this.cache.IdFromLabel[type];
    // }

    // for (const edge of this.graph.Edges) {
    //     if (edge.Label === PnpParser.LABEL.LABEL && edge.TargetNode.Value ===
    //     type) {
    //         this.cache.IdFromLabel[type] = edge.SourceNode.Id;
    //         return edge.SourceNode.Id;
    //     }
    // }

    // return null;
  }

  getIdFromType(pnpContext: PnPMetaModelContext, type: string): string|null {
    const value = pnpContext['@context'][type];
    let label = '';
    if (value) {
      if (typeof value === 'string') {
        label = value;
      } else {
        label = value['@id'];
      }
    }

    if (!label) {
      label = type;
      console.log(`Cannot find label from type ${type}`);
    }

    return this.getIdFromLabel(pnpContext, label);
  }

  getPropertyNameFromId(pnpContext: PnPMetaModelContext, id: string) {
    if (this.cache.PropertyNameFromId[id]) {
      return this.cache.PropertyNameFromId[id];
    }
    const context = pnpContext['@context'];
    const base = pnpContext['@context']['@vocab'];
    for (const key of Object.keys(context)) {
      const item = context[key];
      const path: string = typeof item === 'string' ? item : item['@id'];
      if (base + path === id) {
        this.cache.PropertyNameFromId[id] = key;
        return key;
      }
    }

    console.log(`Connot get property name for ${id}`);
    return id;
  }

  getTypedPropertiesFromId(pnpContext: PnPMetaModelContext, id: string) {
    const keys = this.getPropertiesFromId(pnpContext, id);
    const type = this.getLabelFromId(pnpContext, id);
    const getRequiredProperties = this.getRequiredPropertiesFromType(type);
    const results: Array<{label: string, required: boolean, type: string}> = [];
    for (const key of keys) {
      const id = this.getIdFromShortName(pnpContext, key);
      if (!id) {
        continue;
      }
      const item = {
        label: key,
        required: getRequiredProperties.indexOf(key) !== -1,
        type: this.isArrayFromShortName(key) ?
            'array' :
            (this.getValueTypesFromId(id)[0] || '')
      };
      results.push(item);
    }
    return results;
  }

  getTypedPropertiesFromType(pnpContext: PnPMetaModelContext, type: string) {
    if (type === 'Interface') {
      pnpContext = this.pnpInterface;
    }
    if (type === 'CapabilityModel') {
      pnpContext = this.pnpCapabilityModel;
    }
    const id = this.getIdFromType(pnpContext, type);
    if (!id) {
      console.warn(`Cannot find ID for type ${type}.`);
      return [];
    }
    const results = this.getTypedPropertiesFromId(pnpContext, id);
    console.log(results);
    return results;
  }

  getPropertiesFromId(pnpContext: PnPMetaModelContext, id: string) {
    console.log(`Checking properties for ${id}...`);
    let properties: string[] = [];

    for (const edge of this.graph.Edges) {
      if (edge.TargetNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.DOMAIN) {
        properties.push(
            this.getPropertyNameFromId(pnpContext, edge.SourceNode.Id));
      } else if (
          edge.SourceNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.SUBCLASS) {
        console.log(`Found sub class of for ${id}: ${edge.TargetNode.Id}`);
        properties = properties.concat(
            this.getPropertiesFromId(pnpContext, edge.TargetNode.Id));
      }
    }

    const keys = uniq(properties).sort();
    return keys;
  }

  getPropertiesFromType(pnpContext: PnPMetaModelContext, type: string) {
    const id = this.getIdFromType(pnpContext, type);
    if (!id) {
      console.warn(`Cannot find ID for type ${type}.`);
      return [];
    }
    const results = this.getPropertiesFromId(pnpContext, id);
    console.log(results);
    return results;
  }

  getTypesFromLabel(pnpContext: PnPMetaModelContext, label: string) {
    const id = this.getIdFromLabel(pnpContext, label);
    if (!id) {
      console.warn(`Cannot find ID for type ${label}.`);
      return [];
    }

    return this.getTypesFromId(pnpContext, id);
  }

  getTypesFromShortName(pnpContext: PnPMetaModelContext, shortName: string) {
    const id = this.getIdFromShortName(pnpContext, shortName);
    if (!id) {
      console.warn(`Cannot find ID for short name ${shortName}.`);
      return [];
    }

    return this.getTypesFromId(pnpContext, id);
  }

  getTypesFromId(pnpContext: PnPMetaModelContext, id: string): string[] {
    if (this.cache.TypesFromId[id]) {
      return this.cache.TypesFromId[id];
    }
    let types: string[] = [];

    for (const edge of this.graph.Edges) {
      if (edge.SourceNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.RANGE) {
        types =
            types.concat(this.getTypesFromId(pnpContext, edge.TargetNode.Id));
      }

      if (edge.TargetNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.SUBCLASS) {
        types =
            types.concat(this.getTypesFromId(pnpContext, edge.SourceNode.Id));
      }
    }

    if (types.length === 0) {
      const label = this.getLabelFromId(pnpContext, id);
      const shortName = this.getShortNameFromLabel(pnpContext, label);
      types.push(shortName);
    }
    types = uniq(types).sort();

    this.cache.TypesFromId[id] = types;
    return types;
  }

  getLabelFromId(pnpContext: PnPMetaModelContext, id: string) {
    if (id.indexOf(pnpContext['@context']['@vocab']) === 0) {
      return id.substr(pnpContext['@context']['@vocab'].length);
    }
    console.warn(`Cannot find label for ${id}.`);
    return id;
    // for (const edge of this.graph.Edges) {
    //     if (edge.SourceNode.Id === id && edge.Label ===
    //     PnpParser.LABEL.LABEL) {
    //         return edge.TargetNode.Value;
    //     }
    // }
    // console.warn(`Cannot find label for ${id}.`);
    // return id;
  }

  getShortNameFromLabel(pnpContext: PnPMetaModelContext, label: string) {
    const context = pnpContext['@context'];
    let labelInInterface = '';
    for (const key of Object.keys(context)) {
      const item = context[key];
      if (typeof item === 'string') {
        labelInInterface = item;
      } else {
        labelInInterface = item['@id'];
      }

      if (labelInInterface === label) {
        return key;
      }
    }

    console.log(`Cannot find short name for label ${label}.`);
    return label;
  }

  isArrayFromShortName(shortName: string) {
    return [
      'contents', 'schemas', 'fields', 'enumValues', 'implements'
    ].indexOf(shortName) > -1;
  }

  getStringValuesFromLabel(pnpContext: PnPMetaModelContext, label: string) {
    const id = this.getIdFromLabel(pnpContext, label);
    if (!id) {
      console.warn(`Cannot find ID for type ${label}.`);
      return [];
    }

    return this.getStringValuesFromId(id);
  }

  getStringValuesFromShortName(
      pnpContext: PnPMetaModelContext, shortName: string) {
    if (shortName === 'implements') {
      return [];
    }
    const id = this.getIdFromShortName(pnpContext, shortName);
    if (!id) {
      console.warn(`Cannot find ID for short name ${shortName}.`);
      return [];
    }

    return this.getStringValuesFromId(id);
  }

  getStringValuesFromId(id: string) {
    let values: string[] = [];
    let hasProperty = false;
    for (const edge of this.graph.Edges) {
      if (edge.TargetNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.DOMAIN) {
        hasProperty = true;
      }
      if (edge.SourceNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.RANGE) {
        console.log(`${id} has range of ${edge.TargetNode.Id}`);
        values = values.concat(this.getStringValuesFromId(edge.TargetNode.Id));
      }
      if (edge.TargetNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.SUBCLASS) {
        console.log(`${edge.SourceNode.Id} is sub class of ${id}`);
        values = values.concat(this.getStringValuesFromId(edge.SourceNode.Id));
      }
      if (edge.TargetNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.TYPE) {
        console.log(`${edge.SourceNode.Id} has type of ${id}`);
        values = values.concat(this.getStringValuesFromId(edge.SourceNode.Id));
      }
    }
    if (values.length === 0) {
      if (hasProperty) {
        // this is object, ignore it
        console.log(`${id} is an object, ignored`);
        return [];
      }
      const shortName = this.getShortNameFromId(id);
      if (shortName) {
        console.log(`${id} has string value of ${shortName}`);
        values.push(shortName);
      }
    }
    return values;
  }

  getShortNameFromId(id: string) {
    return id.split('/').pop();
  }

  getValueTypesFromId(id: string) {
    if (!id) {
      return [];
    }
    const values = this.getStringValuesFromId(id);
    const valueTypes: string[] = [];
    values.forEach(value => {
      switch (value) {
        case 'XMLSchema#boolean':
          valueTypes.push('boolean');
          break;
        case 'XMLSchema#int':
          valueTypes.push('int');
          break;
        case 'XMLSchema#long':
          valueTypes.push('long');
          break;
        case 'XMLSchema#float':
          valueTypes.push('float');
          break;
        case 'XMLSchema#double':
          valueTypes.push('double');
          break;
        case 'XMLSchema#string':
          valueTypes.push('string');
          break;
        default:
          console.log(`High level type: ${value}`);
          break;
      }
    });

    return valueTypes;
  }

  getStringValuePattern(key: string) {
    switch (key) {
      case 'name':
        return /^[a-zA-Z0-9_]+$/;
      case 'implements':
        return /^(http|https):\/\/.+\.interface\/.json$/;
      default:
        return null;
    }
  }

  getRequiredPropertiesFromType(type: string) {
    // I know, I know, hard code is ugly...
    // It's just fine :)
    switch (type) {
      case 'Interface':
        return ['@id', '@type', '@context'];
      case 'Telemetry':
        return ['@type', 'name', 'schema'];
      case 'Property':
        return ['@type', 'name', 'schema'];
      case 'Command':
        return ['@type', 'name'];
      case 'Array':
        return ['@type', 'elementSchema'];
      case 'Enum':
        return ['@type', 'enumValues'];
      case 'EnumValue':
        return ['name'];
      case 'Map':
        return ['@type', 'mapKey', 'mapValue'];
      case 'MapKey':
        return ['name', 'schema'];
      case 'MapValue':
        return ['name', 'schema'];
      case 'Object':
        return ['@type', 'fields'];
      case 'SchemaField':
        return ['name', 'schema'];
      case 'Boolean':
      case 'Bytes':
      case 'Date':
      case 'DateTime':
      case 'Duration':
      case 'Float':
      case 'Integer':
      case 'Long':
      case 'String':
      case 'Time':
        return ['@type'];
      case 'CapabilityModel':
        return ['@id', '@type', '@context', 'implements'];
      default:
        return [];
    }
  }
}