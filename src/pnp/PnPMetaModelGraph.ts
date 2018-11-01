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
  private graph: PnPMetaModelGraph;
  private pnpInterface: PnPMetaModelContext;

  static LABEL = {
    DOMAIN: 'http://www.w3.org/2000/01/rdf-schema#domain',
    LABEL: 'http://www.w3.org/2000/01/rdf-schema#label',
    SUBCLASS: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    RANGE: 'http://www.w3.org/2000/01/rdf-schema#range',
    TYPE: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    COMMENT: 'http://www.w3.org/2000/01/rdf-schema#comment'
  };

  constructor(graph: PnPMetaModelGraph, pnpInterface: PnPMetaModelContext) {
    this.graph = graph;
    this.pnpInterface = pnpInterface;
  }

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

  getIdFromShortName(shortName: string): string {
    if (this.pnpInterface['@context'].hasOwnProperty(shortName)) {
      const shortNameValue = this.pnpInterface['@context'][shortName];
      if (typeof shortNameValue === 'string') {
        return this.pnpInterface['@context']['@vocab'] + shortNameValue;
      } else {
        return this.pnpInterface['@context']['@vocab'] + shortNameValue['@id'];
      }
    } else {
      return shortName;
    }
  }

  getIdFromLabel(label: string): string|null {
    return this.pnpInterface['@context']['@vocab'] + label;
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

  getIdFromType(type: string): string|null {
    const value = this.pnpInterface['@context'][type];
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

    return this.getIdFromLabel(label);
  }

  getPropertyNameFromId(id: string) {
    if (this.cache.PropertyNameFromId[id]) {
      return this.cache.PropertyNameFromId[id];
    }
    const context = this.pnpInterface['@context'];
    const base = this.pnpInterface['@context']['@vocab'];
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

  getTypedPropertiesFromId(id: string) {
    const keys = this.getPropertiesFromId(id);
    const results: Array<{label: string, type: string}> = [];
    for (const key of keys) {
      const id = this.getIdFromShortName(key);
      const item = {
        label: key,
        type: this.isArrayFromShortName(key) ? 'array' :
                                               this.getValueTypeFromId(id)
      };
      results.push(item);
    }
    return results;
  }

  getTypedPropertiesFromType(type: string) {
    const id = this.getIdFromType(type);
    if (!id) {
      console.warn(`Cannot find ID for type ${type}.`);
      return [];
    }
    const results = this.getTypedPropertiesFromId(id);
    console.log(results);
    return results;
  }

  getPropertiesFromId(id: string) {
    console.log(`Checking properties for ${id}...`);
    let properties: string[] = [];

    for (const edge of this.graph.Edges) {
      if (edge.TargetNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.DOMAIN) {
        properties.push(this.getPropertyNameFromId(edge.SourceNode.Id));
      } else if (
          edge.SourceNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.SUBCLASS) {
        console.log(`Found sub class of for ${id}: ${edge.TargetNode.Id}`);
        properties =
            properties.concat(this.getPropertiesFromId(edge.TargetNode.Id));
      }
    }

    const keys = uniq(properties).sort();
    return keys;
  }

  getPropertiesFromType(type: string) {
    const id = this.getIdFromType(type);
    if (!id) {
      console.warn(`Cannot find ID for type ${type}.`);
      return [];
    }
    const results = this.getPropertiesFromId(id);
    console.log(results);
    return results;
  }

  getTypesFromLabel(label: string) {
    const id = this.getIdFromLabel(label);
    if (!id) {
      console.warn(`Cannot find ID for type ${label}.`);
      return [];
    }

    return this.getTypesFromId(id);
  }

  getTypesFromShortName(shortName: string) {
    const id = this.getIdFromShortName(shortName);
    if (!id) {
      console.warn(`Cannot find ID for short name ${shortName}.`);
      return [];
    }

    return this.getTypesFromId(id);
  }

  getTypesFromId(id: string): string[] {
    if (this.cache.TypesFromId[id]) {
      return this.cache.TypesFromId[id];
    }
    let types: string[] = [];

    for (const edge of this.graph.Edges) {
      if (edge.SourceNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.RANGE) {
        types = types.concat(this.getTypesFromId(edge.TargetNode.Id));
      }

      if (edge.TargetNode.Id === id &&
          edge.Label === PnPMetaModelParser.LABEL.SUBCLASS) {
        types = types.concat(this.getTypesFromId(edge.SourceNode.Id));
      }
    }

    if (types.length === 0) {
      const label = this.getLabelFromId(id);
      const shortName = this.getShortNameFromLabel(label);
      types.push(shortName);
    }
    types = uniq(types).sort();

    this.cache.TypesFromId[id] = types;
    return types;
  }

  getLabelFromId(id: string) {
    if (id.indexOf(this.pnpInterface['@context']['@vocab']) === 0) {
      return id.substr(this.pnpInterface['@context']['@vocab'].length);
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

  getShortNameFromLabel(label: string) {
    const context = this.pnpInterface['@context'];
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
    return ['contents', 'schemas', 'fields', 'enumValues'].indexOf(shortName) >
        -1;
  }

  getStringValuesFromLabel(label: string) {
    const id = this.getIdFromLabel(label);
    if (!id) {
      console.warn(`Cannot find ID for type ${label}.`);
      return [];
    }

    return this.getStringValuesFromId(id);
  }

  getStringValuesFromShortName(shortName: string) {
    const id = this.getIdFromShortName(shortName);
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

  getValueTypeFromId(id: string) {
    if (!id) {
      return '';
    }
    const values = this.getStringValuesFromId(id);
    if (values.length !== 1) {
      return '';
    }
    switch (values[0]) {
      case 'XMLSchema#boolean':
        return 'boolean';
      case 'XMLSchema#int':
      case 'XMLSchema#long':
        return 'int';
      case 'XMLSchema#float':
      case 'XMLSchema#double':
        return 'float';
      case 'XMLSchema#string':
        return 'string';
      default:
        return '';
    }
  }
}