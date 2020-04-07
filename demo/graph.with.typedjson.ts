import "reflect-metadata";
import { jsonObject, jsonMember, jsonArrayMember, jsonMapMember, TypedJSON } from "typedjson";

/**
 * Class node of DigitalTwin graph
 */
@jsonObject
export class ClassNode {
    @jsonMember
    id: string;
    @jsonMember
    label?: string;
    @jsonMember
    isAbstract?: boolean;
    @jsonArrayMember(ClassNode)
    children?: ClassNode[];
    @jsonArrayMember(PropertyNode)
    properties?: PropertyNode[];
    @jsonArrayMember(string)
    enums?: string[];
    @jsonMember
    constraint?: ConstraintNode;
    @jsonMember
    version?: VersionNode;
}

/**
 * Property node of DigitalTwin graph
 */
export class PropertyNode {
    @jsonMember
    id: string;
    @jsonMember
    label?: string;
    @jsonMember
    isArray?: boolean;
    @jsonMember
    comment?: string;
    @jsonArrayMember(ClassNode)
    range?: ClassNode[];
    @jsonMember
    constraint?: ConstraintNode;
    @jsonMember
    version?: VersionNode;
}

/**
 * Constraint node of DigitalTwin graph
 */
export class ConstraintNode {
    @jsonMember
    minItems?: number;
    @jsonMember
    maxItems?: number;
    @jsonMember
    minLength?: number;
    @jsonMember
    maxLength?: number;
    @jsonMember
    pattern?: string;
    @jsonArrayMember(string)
    required?: string[];
}

/**
 * Version node of DigitalTwin graph
 */
export class VersionNode {
    @jsonMember
    includeSince?: number;
    @jsonMember
    excludeSince?: number;
}

/**
 * Context node of DigitalTwin graph
 */
class ContextNode {
    @jsonMember
    name: string;
    @jsonMember
    container: ContainerType;
}


/**
 * Container type of JSON-LD
 */
enum ContainerType {
  None,
  Array,
  Language
}

@jsonObject
export class DigitalTwinGraph {
    @jsonMapMember(string, ClassNode)
	classNodes: Map<string, ClassNode>;
    @jsonMapMember(string, PropertyNode)
	propertyNodes: Map<string, PropertyNode>;
    @jsonMapMember(string, ContextNode)
	contextNodes: Map<string, ContextNode>;
    @jsonMapMember(string, ConstraintNode)
	constraintNodes: Map<string, ConstraintNode>;
    @jsonMapMember(string, string)
	reversedIndex: Map<string, string>;
    @jsonMapMember(string, number)
	contextVersions: Map<string, number>;
    @jsonMember
    vocabulary: string;

    constructor() {
        this.classNodes = new Map<string, ClassNode>();
        this.propertyNodes = new Map<string, PropertyNode>();
        this.contextNodes = new Map<string, ContextNode>();
        this.constraintNodes = new Map<string, ConstraintNode>();
        this.reversedIndex = new Map<string, string>();
        this.contextVersions = new Map<string, number>();
        this.vocabulary = Constants.EMPTY_STRING;
    }
}

function sameInstances(x: DigitalTwinGraph, y: DigitalTwinGraph): boolean {
    if (x.vocabulary !== y.vacabulary) {
        return false;
    }

    let sameMaps = (m1: Map, m2: Map): boolean => {
        if (m1.size !== m2.size) {
            return false;
        }

        for (let [k, v] of m1) {
            if (m2.get(k) === undefined) {
                return false;
            }
        }

        return true;
    };

    if (sameMaps(x.classNodes, y.classNodes) === false ||
        sameMaps(x.propertyNodes, y.propertyNodes) === false ||
        sameMaps(x.contextNodes, y.contextNodes) === false ||
        sameMaps(x.constraintNodes, y.constraintNodes) === false ||
        sameMaps(x.reversedIndex, y.reversedIndex) === false ||
        sameMaps(x.contextVersions, y.contextVersions) === false) {
        return false;
    }

}
