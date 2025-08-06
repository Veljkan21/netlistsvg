import { FlatModule } from './FlatModule';
import _ = require('lodash');

export namespace ElkModel {
    interface WireNameLookup {
        [edgeId: string]: string;
    }
    export let wireNameLookup: WireNameLookup = {};
    export let dummyNum: number = 0;
    export let edgeIndex: number = 0;

    export interface WirePoint {
        x: number;
        y: number;
    }

    export interface Cell {
        id: string;
        width: number;
        height: number;
        ports: Port[];
        layoutOptions?: LayoutOptions;
        labels?: Label[];
        x?: number;
        y?: number;
    }

    export interface Graph {
        id: string;
        children: Cell[];
        edges: (Edge | ExtendedEdge)[];
        width?: number;
        height?: number;
    }

    export interface Port {
        id: string;
        width: number;
        height: number;
        x?: number;
        y?: number;
        labels?: Label[];
    }

    export interface Section {
        id?: string;
        startPoint: WirePoint;
        endPoint: WirePoint;
        bendPoints?: WirePoint[];
    }

    export interface Edge {
        id: string;
        labels?: Label[];
        source: string;
        sourcePort: string;
        target: string;
        targetPort: string;
        layoutOptions?: LayoutOptions;
        junctionPoints?: WirePoint[];
        bendPoints?: WirePoint[];
        sections?: Section[];
    }

    export interface ExtendedEdge {
        id: string;
        labels?: Label[];
        sources: [string];
        targets: [string];
        layoutOptions?: LayoutOptions;
    }

    export interface LayoutOptions {
        [option: string]: any;
    }

    export interface Label {
        id: string;
        text: string;
        x: number;
        y: number;
        height: number;
        width: number;
        layoutOptions?: LayoutOptions;
    }
}

export function buildElkGraph(module: FlatModule): ElkModel.Graph {
    console.log(`🧱 buildElkGraph: Startujem za modul "${module.moduleName}"`);
    console.log(`📦 buildElkGraph: Ukupno čvorova: ${module.nodes.length}`);

    const children: ElkModel.Cell[] = module.nodes.map((n) => {
        return n.buildElkChild();
    });

    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;

    console.log(`🔗 buildElkGraph: Počinjem obradu žica... (${module.wires.length} ukupno)`);

    const edges: ElkModel.Edge[] = _.flatMap(module.wires, (w, i) => {
        if (i % 1000 === 0) {
            console.log(`  🧮 Obrada žice #${i} (${w.netName})`);
        }

        const numWires = w.netName.split(',').length - 2;

        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            const ret: ElkModel.Edge[] = [];
            route(w.drivers, w.riders, ret, numWires);
            return ret;
        } else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            const ret: ElkModel.Edge[] = [];
            route(w.drivers, w.laterals, ret, numWires);
            route(w.laterals, w.riders, ret, numWires);
            return ret;
        } else if (w.riders.length === 0 && w.drivers.length > 1) {
            const dummyId: string = addDummy(children);
            ElkModel.dummyNum += 1;
            return w.drivers.map((driver) => {
                const id: string = 'e' + ElkModel.edgeIndex++;
                const sourceParentKey = driver.parentNode.Key;
                const edge: ElkModel.Edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId,
                    targetPort: dummyId + '.p',
                };
                ElkModel.wireNameLookup[id] = driver.wire.netName;
                return edge;
            });
        } else if (w.riders.length > 1 && w.drivers.length === 0) {
            const dummyId: string = addDummy(children);
            ElkModel.dummyNum += 1;
            return w.riders.map((rider) => {
                const id: string = 'e' + ElkModel.edgeIndex++;
                const targetParentKey = rider.parentNode.Key;
                const edge: ElkModel.Edge = {
                    id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: targetParentKey,
                    targetPort: targetParentKey + '.' + rider.key,
                };
                ElkModel.wireNameLookup[id] = rider.wire.netName;
                return edge;
            });
        } else if (w.laterals.length > 1) {
            const source = w.laterals[0];
            const sourceParentKey = source.parentNode.Key;
            return w.laterals.slice(1).map((lateral) => {
                const id: string = 'e' + ElkModel.edgeIndex++;
                const lateralParentKey = lateral.parentNode.Key;
                const edge: ElkModel.Edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + source.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key,
                };
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
                return edge;
            });
        }
        return [];
    });

    console.log(`✅ buildElkGraph: Gotovo. Čvorova: ${children.length}, Veza: ${edges.length}`);
    return {
        id: module.moduleName,
        children,
        edges,
    };
}

function addDummy(children: ElkModel.Cell[]) {
    const dummyId: string = '$d_' + String(ElkModel.dummyNum);
    const child: ElkModel.Cell = {
        id: dummyId,
        width: 0,
        height: 0,
        ports: [{
            id: dummyId + '.p',
            width: 0,
            height: 0,
        }],
        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
    };
    children.push(child);
    return dummyId;
}

function route(sourcePorts, targetPorts, edges: ElkModel.Edge[], numWires) {
    const newEdges: ElkModel.Edge[] = _.flatMap(sourcePorts, (sourcePort) => {
        const sourceParentKey: string = sourcePort.parentNode.key;
        const sourceKey: string = sourceParentKey + '.' + sourcePort.key;
        let edgeLabel: ElkModel.Label[] | undefined;

        if (numWires > 1) {
            edgeLabel = [{
                id: '',
                text: String(numWires),
                width: 4,
                height: 6,
                x: 0,
                y: 0,
                layoutOptions: {
                    'org.eclipse.elk.edgeLabels.inline': true,
                },
            }];
        }

        return targetPorts.map((targetPort) => {
            const targetParentKey: string = targetPort.parentNode.key;
            const targetKey: string = targetParentKey + '.' + targetPort.key;
            const id: string = 'e' + ElkModel.edgeIndex++;

            const edge: ElkModel.ExtendedEdge = {
                id,
                labels: edgeLabel,
                sources: [sourceKey],
                targets: [targetKey],
                layoutOptions: {
                    'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1),
                    ...(sourcePort.parentNode.type !== '$dff' && {
                        'org.eclipse.elk.layered.priority.direction': 10,
                    })
                },
            };

            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            return edge;
        });
    });

    edges.push(...newEdges);
}
