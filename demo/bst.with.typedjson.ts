import "reflect-metadata";
import { jsonObject, jsonMember, TypedJSON } from "typedjson";

namespace demo {
    @jsonObject
    class Node {
        @jsonMember
        left_: Node;
        @jsonMember
        right_: Node;
        @jsonMember
        value_: number;

        constructor() {
            this.left_ = null;
            this.right_ = null;
            this.value_ = 0;
        }

        setValue(newValue: number): void {
            this.value_ = newValue; 
        }

        showValue(): number {
            return this.value_;
        }
    }

    @jsonObject
    export class BinarySearchTree {
        @jsonMember
        root_: Node;

        constructor() {
            this.root_ = null;
        }

        add(newValue: number): void {
            if (this.root_ === null) {
                this.root_ = new Node();
                this.root_.setValue(newValue);
                return ;
            }

            this.recursiveAdd(newValue, this.root_);
        }

        recursiveAdd(newValue: number, current: Node): void {
            if (newValue < current.value_) {
                // go to left.
                if (current.left_ === null) {
                    current.left_ = new Node();
                    current.left_.setValue(newValue);
                    return ;
                }

                this.recursiveAdd(newValue, current.left_);
            } else {
                // go to right.
                if (current.right_ === null) {
                    current.right_ = new Node();
                    current.right_.setValue(newValue);
                    return ;
                }

                this.recursiveAdd(newValue, current.right_);
            }
        }

        print(): void {
            this.recursivePrint(this.root_); 
        }

        recursivePrint(current: Node): void {
            if (current === null) {
                return ;
            }

            let leftValue: number = null;
            let rightValue: number = null;
            if (current.left_ !== null) {
                leftValue = current.left_.showValue();
            }
            if (current.right_ !== null) {
                rightValue = current.right_.showValue();
            }

            console.log(`${current.showValue()}->(${leftValue}, ${rightValue})`);

            if (current.left_ !== null) {
                this.recursivePrint(current.left_);
            }
            if (current.right_ !== null) {
                this.recursivePrint(current.right_);
            }
        }
    }
}

let bst: demo.BinarySearchTree = new demo.BinarySearchTree();
let i: number = 0;
for (;i < 10; i++) {
    let randValue: number = Math.floor(Math.random() * 100); 
    console.log(`randValue is ${randValue}`);
    bst.add(randValue);
}
bst.print();

const serializer = new TypedJSON(demo.BinarySearchTree);

const json = serializer.stringify(bst);
console.log(`json:${json}`);

const back = serializer.parse(json);
console.log("back.print():");
back.print();
