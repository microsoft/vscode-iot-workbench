namespace demo {
    class Node {
        left_: Node;
        right_: Node;
        value_: number

        constructor(value: number) {
            this.left_ = null;
            this.right_ = null;
            this.value_ = value;
        }

        showValue(): number {
            return this.value_;
        }
    }

    export class BinarySearchTree {
        root_: Node;

        constructor() {
            this.root_ = null;
        }

        add(newValue: number): void {
            if (this.root_ === null) {
                this.root_ = new Node(newValue);
                return ;
            }

            this.recursiveAdd(newValue, this.root_);    
        }

        recursiveAdd(newValue: number, current: Node): void {
            if (newValue < current.value_) {
                // go to left.
                if (current.left_ === null) {
                    current.left_ = new Node(newValue);
                    return ;
                }

                this.recursiveAdd(newValue, current.left_);
            } else {
                // go to right.
                if (current.right_ === null) {
                    current.right_ = new Node(newValue);
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
