import {DigitalTwinMetaModelContext} from './DigitalTwinMetaModelUtility';
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

export interface DigitalTwinMetaModelGraph {
  Nodes: GraphNode[];
  Edges: GraphEdge[];
}

export interface Map<T> { [key: string]: T; }

export class DigitalTwinMetaModelParser {
  static LABEL = {
    DOMAIN: 'http://www.w3.org/2000/01/rdf-schema#domain',
    LABEL: 'http://www.w3.org/2000/01/rdf-schema#label',
    SUBCLASS: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    RANGE: 'http://www.w3.org/2000/01/rdf-schema#range',
    TYPE: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    COMMENT: 'http://www.w3.org/2000/01/rdf-schema#comment'
  };

  constructor(
      private graph: DigitalTwinMetaModelGraph,
      private dtInterface: DigitalTwinMetaModelContext,
      private dtCapabilityModel: DigitalTwinMetaModelContext) {}

  cache = {
    IdFromLabel: {} as Map<string>,
    PropertyNameFromId: {} as Map<string>,
    TypesFromId: {} as Map<string[]>,
    ValueTypesFromId: {} as Map<string[]>,
    StringValuesFromId: {} as Map<string[]>,
    PropertiesFromId: {} as Map<string[]>,
    CommnetFromId: {} as Map<string>,
    TypedPropertiesFromId: {} as
        Map<Array<{label: string, required: boolean, type: string}>>,
    ShortNameFromLabel: {} as Map<string|null>
  };

  getCommentFromId(id: string): string|undefined {
    if (this.cache.CommnetFromId[id] !== undefined) {
      return this.cache.CommnetFromId[id];
    }
    for (const edge of this.graph.Edges) {
      if (edge.SourceNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.COMMENT) {
        this.cache.CommnetFromId[id] = edge.TargetNode.Value || '';
        return edge.TargetNode.Value;
      }
    }
    this.cache.CommnetFromId[id] = '';
    return undefined;
  }

  getIdFromShortName(dtContext: DigitalTwinMetaModelContext, shortName: string):
      string|null {
    if (dtContext['@context'].hasOwnProperty(shortName)) {
      const shortNameValue = dtContext['@context'][shortName];
      if (typeof shortNameValue === 'string') {
        return dtContext['@context']['@vocab'] + shortNameValue;
      } else {
        return dtContext['@context']['@vocab'] + shortNameValue['@id'];
      }
    } else {
      return null;
    }
  }

  getIdFromLabel(dtContext: DigitalTwinMetaModelContext, label: string): string
      |null {
    return dtContext['@context']['@vocab'] + label;
    // if (this.cache.IdFromLabel[type]) {
    //     return this.cache.IdFromLabel[type];
    // }

    // for (const edge of this.graph.Edges) {
    //     if (edge.Label === DigitalTwinMetaModelParser.LABEL.LABEL &&
    //     edge.TargetNode.Value === type) {
    //         this.cache.IdFromLabel[type] = edge.SourceNode.Id;
    //         return edge.SourceNode.Id;
    //     }
    // }

    // return null;
  }

  getIdFromType(dtContext: DigitalTwinMetaModelContext, type: string): string
      |null {
    const value = dtContext['@context'][type];
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

    return this.getIdFromLabel(dtContext, label);
  }

  getPropertyNameFromId(dtContext: DigitalTwinMetaModelContext, id: string) {
    if (this.cache.PropertyNameFromId[id]) {
      return this.cache.PropertyNameFromId[id];
    }
    const context = dtContext['@context'];
    const base = dtContext['@context']['@vocab'];
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

  getTypedPropertiesFromId(dtContext: DigitalTwinMetaModelContext, id: string) {
    if (this.cache.TypedPropertiesFromId[id]) {
      return this.cache.TypedPropertiesFromId[id];
    }
    const keys = this.getPropertiesFromId(dtContext, id);
    const type = this.getShortNameFromId(id);
    const getRequiredProperties =
        type ? this.getRequiredPropertiesFromType(type) : [];
    const results: Array<{label: string, required: boolean, type: string}> = [];
    for (const key of keys) {
      const id = this.getIdFromShortName(dtContext, key);
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
    this.cache.TypedPropertiesFromId[id] = results;
    return results;
  }

  getTypedPropertiesFromType(
      dtContext: DigitalTwinMetaModelContext, type: string) {
    if (type === 'Interface') {
      dtContext = this.dtInterface;
    }
    if (type === 'CapabilityModel') {
      dtContext = this.dtCapabilityModel;
    }
    const id = this.getIdFromType(dtContext, type);
    if (!id) {
      console.warn(`Cannot find ID for type ${type}.`);
      return [];
    }
    const results = this.getTypedPropertiesFromId(dtContext, id);
    console.log(id, results);
    return results;
  }

  getPropertiesFromId(dtContext: DigitalTwinMetaModelContext, id: string) {
    if (this.cache.PropertiesFromId[id]) {
      return this.cache.PropertiesFromId[id];
    }
    console.log(`Checking properties for ${id}...`);
    let properties: string[] = [];

    for (const edge of this.graph.Edges) {
      if (edge.TargetNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.DOMAIN) {
        properties.push(
            this.getPropertyNameFromId(dtContext, edge.SourceNode.Id));
      } else if (
          edge.SourceNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.SUBCLASS) {
        console.log(`Found sub class of for ${id}: ${edge.TargetNode.Id}`);
        properties = properties.concat(
            this.getPropertiesFromId(dtContext, edge.TargetNode.Id));
      }
    }

    const keys = uniq(properties).sort();
    this.cache.PropertiesFromId[id] = keys;
    return keys;
  }

  getPropertiesFromType(dtContext: DigitalTwinMetaModelContext, type: string) {
    const id = this.getIdFromType(dtContext, type);
    if (!id) {
      console.warn(`Cannot find ID for type ${type}.`);
      return [];
    }
    const results = this.getPropertiesFromId(dtContext, id);
    console.log(results);
    return results;
  }

  getTypesFromLabel(dtContext: DigitalTwinMetaModelContext, label: string) {
    const id = this.getIdFromLabel(dtContext, label);
    if (!id) {
      console.warn(`Cannot find ID for type ${label}.`);
      return [];
    }

    return this.getTypesFromId(dtContext, id);
  }

  getTypesFromShortName(
      dtContext: DigitalTwinMetaModelContext, shortName: string) {
    const id = this.getIdFromShortName(dtContext, shortName);
    if (!id) {
      console.warn(`Cannot find ID for short name ${shortName}.`);
      return [];
    }

    return this.getTypesFromId(dtContext, id);
  }

  getTypesFromId(dtContext: DigitalTwinMetaModelContext, id: string): string[] {
    if (this.cache.TypesFromId[id]) {
      return this.cache.TypesFromId[id];
    }
    let types: string[] = [];

    for (const edge of this.graph.Edges) {
      if (edge.SourceNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.RANGE) {
        types =
            types.concat(this.getTypesFromId(dtContext, edge.TargetNode.Id));
      }

      if (edge.TargetNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.SUBCLASS) {
        types =
            types.concat(this.getTypesFromId(dtContext, edge.SourceNode.Id));
      }
    }

    if (types.length === 0) {
      const label = this.getLabelFromId(dtContext, id);
      const shortName = this.getShortNameFromLabel(dtContext, label);
      if (shortName) {
        types.push(shortName);
      }
    }
    types = uniq(types).sort();

    this.cache.TypesFromId[id] = types;
    return types;
  }

  getLabelFromId(dtContext: DigitalTwinMetaModelContext, id: string) {
    let label = '';
    if (id.indexOf(dtContext['@context']['@vocab']) === 0) {
      label = id.substr(dtContext['@context']['@vocab'].length);
    }
    if (label) {
      return label;
    }
    console.warn(`Cannot find label for ${id}.`);
    return id;
    // for (const edge of this.graph.Edges) {
    //     if (edge.SourceNode.Id === id && edge.Label ===
    //     DigitalTwinMetaModelParser.LABEL.LABEL) {
    //         return edge.TargetNode.Value;
    //     }
    // }
    // console.warn(`Cannot find label for ${id}.`);
    // return id;
  }

  getShortNameFromLabel(dtContext: DigitalTwinMetaModelContext, label: string) {
    if (this.cache.ShortNameFromLabel[label] !== undefined) {
      return this.cache.ShortNameFromLabel[label];
    }
    const context = dtContext['@context'];
    let labelInInterface = '';
    for (const key of Object.keys(context)) {
      const item = context[key];
      if (typeof item === 'string') {
        labelInInterface = item;
      } else {
        labelInInterface = item['@id'];
      }

      if (labelInInterface === label) {
        this.cache.ShortNameFromLabel[label] = key;
        return key;
      }
    }

    console.log(`Cannot find short name for label ${label}.`);
    if (label.indexOf('\/') === -1) {
      this.cache.ShortNameFromLabel[label] = label;
      return label;
    } else {
      this.cache.ShortNameFromLabel[label] = null;
      return null;
    }
  }

  isArrayFromShortName(shortName: string) {
    return [
      'contents', 'schemas', 'fields', 'enumValues', 'implements'
    ].indexOf(shortName) > -1;
  }

  getStringValuesFromLabel(
      dtContext: DigitalTwinMetaModelContext, label: string) {
    const id = this.getIdFromLabel(dtContext, label);
    if (!id) {
      console.warn(`Cannot find ID for type ${label}.`);
      return [];
    }

    return this.getStringValuesFromId(id);
  }

  getStringValuesFromShortName(
      dtContext: DigitalTwinMetaModelContext, shortName: string) {
    if (shortName === 'implements') {
      return [];
    }
    const id = this.getIdFromShortName(dtContext, shortName);
    if (!id) {
      console.warn(`Cannot find ID for short name ${shortName}.`);
      return [];
    }

    return this.getStringValuesFromId(id);
  }

  getStringValuesFromId(id: string) {
    if (this.cache.StringValuesFromId[id]) {
      return this.cache.StringValuesFromId[id];
    }
    let values: string[] = [];
    let hasProperty = false;
    for (const edge of this.graph.Edges) {
      if (edge.TargetNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.DOMAIN) {
        hasProperty = true;
      }
      if (edge.SourceNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.RANGE) {
        console.log(`${id} has range of ${edge.TargetNode.Id}`);
        values = values.concat(this.getStringValuesFromId(edge.TargetNode.Id));
      }
      if (edge.TargetNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.SUBCLASS) {
        console.log(`${edge.SourceNode.Id} is sub class of ${id}`);
        values = values.concat(this.getStringValuesFromId(edge.SourceNode.Id));
      }
      if (edge.TargetNode.Id === id &&
          edge.Label === DigitalTwinMetaModelParser.LABEL.TYPE) {
        console.log(`${edge.SourceNode.Id} has type of ${id}`);
        values = values.concat(this.getStringValuesFromId(edge.SourceNode.Id));
      }
    }
    if (values.length === 0) {
      if (hasProperty) {
        // this is object, ignore it
        console.log(`${id} is an object, ignored`);
        this.cache.StringValuesFromId[id] = [];
        return [];
      }
      const shortName = this.getShortNameFromId(id);
      if (shortName) {
        console.log(`${id} has string value of ${shortName}`);
        values.push(shortName);
      }
    }
    this.cache.StringValuesFromId[id] = values;
    return values;
  }

  getShortNameFromId(id: string) {
    return id.split('/').pop();
  }

  getValueTypesFromId(id: string) {
    if (!id) {
      return [];
    }
    if (this.cache.ValueTypesFromId[id]) {
      return this.cache.ValueTypesFromId[id];
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

    this.cache.ValueTypesFromId[id] = valueTypes;
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