"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElkModel = void 0;
exports.buildElkGraph = buildElkGraph;
var _ = require("lodash");
var ElkModel;
(function (ElkModel) {
    ElkModel.wireNameLookup = {};
    ElkModel.dummyNum = 0;
    ElkModel.edgeIndex = 0;
})(ElkModel || (exports.ElkModel = ElkModel = {}));
function buildElkGraph(module) {
    //console.log("\uD83E\uDDF1 buildElkGraph: Startujem za modul \"".concat(module.moduleName, "\""));
    //console.log("\uD83D\uDCE6 buildElkGraph: Ukupno \u010Dvorova: ".concat(module.nodes.length));
    var children = module.nodes.map(function (n) {
        return n.buildElkChild();
    });
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    //console.log("\uD83D\uDD17 buildElkGraph: Po\u010Dinjem obradu \u017Eica... (".concat(module.wires.length, " ukupno)"));
    var edges = _.flatMap(module.wires, function (w, i) {
        if (i % 1000 === 0) {
            //console.log("  \uD83E\uDDEE Obrada \u017Eice #".concat(i, " (").concat(w.netName, ")"));
        }
        var numWires = w.netName.split(',').length - 2;
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            var ret = [];
            route(w.drivers, w.riders, ret, numWires);
            return ret;
        }
        else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            var ret = [];
            route(w.drivers, w.laterals, ret, numWires);
            route(w.laterals, w.riders, ret, numWires);
            return ret;
        }
        else if (w.riders.length === 0 && w.drivers.length > 1) {
            var dummyId_1 = addDummy(children);
            ElkModel.dummyNum += 1;
            return w.drivers.map(function (driver) {
                var id = 'e' + ElkModel.edgeIndex++;
                var sourceParentKey = driver.parentNode.Key;
                var edge = {
                    id: id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId_1,
                    targetPort: dummyId_1 + '.p',
                };
                ElkModel.wireNameLookup[id] = driver.wire.netName;
                return edge;
            });
        }
        else if (w.riders.length > 1 && w.drivers.length === 0) {
            var dummyId_2 = addDummy(children);
            ElkModel.dummyNum += 1;
            return w.riders.map(function (rider) {
                var id = 'e' + ElkModel.edgeIndex++;
                var targetParentKey = rider.parentNode.Key;
                var edge = {
                    id: id,
                    source: dummyId_2,
                    sourcePort: dummyId_2 + '.p',
                    target: targetParentKey,
                    targetPort: targetParentKey + '.' + rider.key,
                };
                ElkModel.wireNameLookup[id] = rider.wire.netName;
                return edge;
            });
        }
        else if (w.laterals.length > 1) {
            var source_1 = w.laterals[0];
            var sourceParentKey_1 = source_1.parentNode.Key;
            return w.laterals.slice(1).map(function (lateral) {
                var id = 'e' + ElkModel.edgeIndex++;
                var lateralParentKey = lateral.parentNode.Key;
                var edge = {
                    id: id,
                    source: sourceParentKey_1,
                    sourcePort: sourceParentKey_1 + '.' + source_1.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key,
                };
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
                return edge;
            });
        }
        return [];
    });
    //console.log("\u2705 buildElkGraph: Gotovo. \u010Cvorova: ".concat(children.length, ", Veza: ").concat(edges.length));
    return {
        id: module.moduleName,
        children: children,
        edges: edges,
    };
}
function addDummy(children) {
    var dummyId = '$d_' + String(ElkModel.dummyNum);
    var child = {
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
function route(sourcePorts, targetPorts, edges, numWires) {
    var newEdges = _.flatMap(sourcePorts, function (sourcePort) {
        var sourceParentKey = sourcePort.parentNode.key;
        var sourceKey = sourceParentKey + '.' + sourcePort.key;
        var edgeLabel;
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
        return targetPorts.map(function (targetPort) {
            var targetParentKey = targetPort.parentNode.key;
            var targetKey = targetParentKey + '.' + targetPort.key;
            var id = 'e' + ElkModel.edgeIndex++;
            var edge = {
                id: id,
                labels: edgeLabel,
                sources: [sourceKey],
                targets: [targetKey],
                layoutOptions: __assign({ 'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1) }, (sourcePort.parentNode.type !== '$dff' && {
                    'org.eclipse.elk.layered.priority.direction': 10,
                })),
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            return edge;
        });
    });
    edges.push.apply(edges, newEdges);
}
