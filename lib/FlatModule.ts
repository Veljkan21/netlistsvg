import Yosys from './YosysModel';
import Skin from './Skin';
import Cell from './Cell';
import _ = require('lodash');

export interface FlatPort {
    key: string;
    value?: number[] | Yosys.Signals;
    parentNode?: Cell;
    wire?: Wire;
}

export interface Wire {
    netName: string;
    drivers: FlatPort[];
    riders: FlatPort[];
    laterals: FlatPort[];
}

export class FlatModule {
    public moduleName: string;
    public nodes: Cell[];
    public wires: Wire[];

    constructor(netlist: Yosys.Netlist) {
        console.log("🧩 [FlatModule] Konstruktor: traženje top modula...");
        this.moduleName = null;
        _.forEach(netlist.modules, (mod: Yosys.Module, name: string) => {
            if (mod.attributes && Number(mod.attributes.top) === 1) {
                this.moduleName = name;
            }
        });

        if (this.moduleName == null) {
            this.moduleName = Object.keys(netlist.modules)[0];
        }

        const top = netlist.modules[this.moduleName];
        console.log(`🔝 [FlatModule] Top modul: ${this.moduleName}`);

        const ports = _.map(top.ports, Cell.fromPort);
        const cells = _.map(top.cells, (c, key) => Cell.fromYosysCell(c, key));
        this.nodes = cells.concat(ports);
        console.log(`📦 [FlatModule] Ukupno čvorova: ${this.nodes.length}`);

        this.wires = [];
    }

    public addConstants(): void {
        console.log("➕ [FlatModule] Dodavanje konstantnih čvorova...");
        let maxNum: number = this.nodes.reduce(((acc, v) => v.maxOutVal(acc)), -1);

        const signalsByConstantName: SigsByConstName = {};
        const cells: Cell[] = [];
        this.nodes.forEach((n) => {
            maxNum = n.findConstants(signalsByConstantName, maxNum, cells);
        });
        this.nodes = this.nodes.concat(cells);
        console.log(`🔢 [FlatModule] Dodato konstanti: ${cells.length}`);
    }

    public addSplitsJoins(): void {
        console.log("🔀 [FlatModule] Dodavanje splits/joins...");
        const allInputs = _.flatMap(this.nodes, (n) => n.inputPortVals());
        const allOutputs = _.flatMap(this.nodes, (n) => n.outputPortVals());

        const allInputsCopy = allInputs.slice();
        const splits: SplitJoin = {};
        const joins: SplitJoin = {};

        allInputs.forEach((input) => {
            gather(allOutputs, allInputsCopy, input, 0, input.length, splits, joins);
        });

        const joinCells = _.map(joins, (joinOutput, joinInputs) => {
            return Cell.fromJoinInfo(joinInputs, joinOutput);
        });

        const splitCells = _.map(splits, (splitOutputs, splitInput) => {
            return Cell.fromSplitInfo(splitInput, splitOutputs);
        });

        this.nodes = this.nodes.concat(joinCells).concat(splitCells);
        console.log(`🔗 [FlatModule] Splits: ${Object.keys(splits).length}, Joins: ${Object.keys(joins).length}`);
    }

    public createWires() {
        console.log("📡 [FlatModule] Kreiranje žica...");
        const layoutProps = Skin.getProperties();
        const ridersByNet: NameToPorts = {};
        const driversByNet: NameToPorts = {};
        const lateralsByNet: NameToPorts = {};

        this.nodes.forEach((n) => {
            n.collectPortsByDirection(
                ridersByNet,
                driversByNet,
                lateralsByNet,
                layoutProps.genericsLaterals as boolean
            );
        });

        const nets = removeDups(
            _.keys(ridersByNet).concat(_.keys(driversByNet)).concat(_.keys(lateralsByNet))
        );

        const wires: Wire[] = nets.map((net) => {
            const drivers: FlatPort[] = driversByNet[net] || [];
            const riders: FlatPort[] = ridersByNet[net] || [];
            const laterals: FlatPort[] = lateralsByNet[net] || [];
            const wire: Wire = { netName: net, drivers, riders, laterals };
            drivers.concat(riders).concat(laterals).forEach((port) => {
                port.wire = wire;
            });
            return wire;
        });

        this.wires = wires;
        console.log(`📬 [FlatModule] Kreirano žica: ${this.wires.length}`);
    }
}


export interface SigsByConstName {
    [constantName: string]: number[];
}

// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
export function arrayToBitstring(bitArray: number[]): string {
    let ret: string = '';
    bitArray.forEach((bit: number) => {
        const sbit = String(bit);
        if (ret === '') {
            ret = sbit;
        } else {
            ret += ',' + sbit;
        }
    });
    return ',' + ret + ',';
}

// returns whether needle is a substring of haystack
function arrayContains(needle: string, haystack: string | string[]): boolean {
    return (haystack.indexOf(needle) > -1);
}

// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle: string, arrhaystack: string[]): number {
    return _.findIndex(arrhaystack, (haystack: string) => {
        return arrayContains(needle, haystack);
    });
}

interface SplitJoin {
    [portName: string]: string[];
}

export function addToDefaultDict(dict: any, key: string, value: any): void {
    if (dict[key] === undefined) {
        dict[key] = [value];
    } else {
        dict[key].push(value);
    }
}

// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring: string,
                          query: string,
                          start: number): string {
    const splitStart: number = _.max([bitstring.indexOf(query), start]);
    const startIndex: number = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex: number = startIndex + query.split(',').length - 3;

    if (startIndex === endIndex) {
        return String(startIndex);
    } else {
        return String(startIndex) + ':' + String(endIndex);
    }
}

function gather(inputs, outputs, initialToSolve, start, end, splits, joins) {
    const callStack = [{
        toSolve: initialToSolve,
        start,
        end,
        inputs: [...inputs],
        outputs: [...outputs]
    }];

    while (callStack.length > 0) {
        const ctx = callStack.pop();
        const { toSolve, inputs, outputs } = ctx;
        let { start, end } = ctx;

        // remove from outputs
        const outputIndex = outputs.indexOf(toSolve);
        if (outputIndex !== -1) {
            outputs.splice(outputIndex, 1);
        }

        if (start >= toSolve.length || end - start < 2) {
            continue;
        }

        const query = toSolve.slice(start, end);

        // perfect match
        if (arrayContains(query, inputs)) {
            if (query !== toSolve) {
                addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
            }
            callStack.push({
                toSolve,
                start: end - 1,
                end: toSolve.length,
                inputs,
                outputs
            });
            continue;
        }

        // partial match
        const index = indexOfContains(query, inputs);
        if (index !== -1) {
            if (query !== toSolve) {
                addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
            }
            addToDefaultDict(splits, inputs[index], getIndicesString(inputs[index], query, 0));
            const newInputs = [...inputs, query];
            callStack.push({
                toSolve,
                start: end - 1,
                end: toSolve.length,
                inputs: newInputs,
                outputs
            });
            continue;
        }

        // match in outputs
        if (indexOfContains(query, outputs) !== -1) {
            if (query !== toSolve) {
                addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
            }
            const newInputs = [...inputs, query];
            callStack.push({
                toSolve: query,
                start: 0,
                end: query.length,
                inputs,
                outputs: []
            });
            callStack.push({
                toSolve,
                start: end - 1,
                end: toSolve.length,
                inputs: newInputs,
                outputs
            });
            continue;
        }

        const lastComma = query.slice(0, -1).lastIndexOf(',');
        if (lastComma !== -1) {
            callStack.push({
                toSolve,
                start,
                end: start + lastComma + 1,
                inputs,
                outputs
            });
        }
    }
}


export interface NameToPorts {
    [netName: string]: FlatPort[];
}

interface StringToBool {
    [s: string]: boolean;
}

export function removeDups(inStrs: string[]): string[] {
    const map: StringToBool = {};
    inStrs.forEach((str) => {
        map[str] = true;
    });
    return _.keys(map);
}
