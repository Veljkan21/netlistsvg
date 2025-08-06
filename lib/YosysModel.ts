namespace Yosys {
    enum ConstantVal {
        Zero = '0',
        One = '1',
        X = 'x',
    }

    export type Signals = (number | ConstantVal)[];

    interface ModuleMap {
        [moduleName: string]: Module;
    }

    export interface Netlist {
        modules: ModuleMap;
    }

    interface ModuleAttributes {
        top?: number | string;
        [attrName: string]: any;
    }

    interface NetAttributes {
        [attrName: string]: any;
    }

    export interface CellAttributes {
        value?: string;
        [attrName: string]: any;
    }

    export enum Direction {
        Input = 'input',
        Output = 'output',
    }

    export interface ExtPort {
        direction: Direction;
        bits: Signals;
    }

    interface ExtPortMap {
        [portName: string]: ExtPort;
    }

    export interface PortDirMap {
        [portName: string]: Direction;
    }

    export interface PortConnectionMap {
        [portName: string]: Signals;
    }

    export interface Cell {
        type: string;
        port_directions: PortDirMap;
        connections: PortConnectionMap;
        attributes?: CellAttributes;
        hide_name?: HideName;
        parameters?: { [key: string]: any };
    }

    export function getInputPortPids(cell: Cell): string[] {
        const keys = Object.keys(cell.port_directions || {});
        const inputs = keys.filter((k) => cell.port_directions[k] === Direction.Input);
        console.log(`🟦 Found ${inputs.length} input ports in cell of type "${cell.type}"`);
        return inputs;
    }

    export function getOutputPortPids(cell: Cell): string[] {
        const keys = Object.keys(cell.port_directions || {});
        const outputs = keys.filter((k) => cell.port_directions[k] === Direction.Output);
        console.log(`🟩 Found ${outputs.length} output ports in cell of type "${cell.type}"`);
        return outputs;
    }

    interface CellMap {
        [cellName: string]: Cell;
    }

    enum HideName {
        Hide,
        NoHide,
    }

    interface Net {
        bits: Signals;
        hide_name: HideName;
        attributes: NetAttributes;
    }

    interface NetNameMap {
        [netName: string]: Net;
    }

    export interface Module {
        ports: ExtPortMap;
        cells: CellMap;
        netNames: NetNameMap;
        attributes?: ModuleAttributes;
    }
}
export default Yosys;
