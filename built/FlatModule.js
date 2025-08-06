"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatModule = void 0;
exports.arrayToBitstring = arrayToBitstring;
exports.addToDefaultDict = addToDefaultDict;
exports.removeDups = removeDups;
var Skin_1 = require("./Skin");
var Cell_1 = require("./Cell");
var _ = require("lodash");
var FlatModule = /** @class */ (function () {
    function FlatModule(netlist) {
        var _this = this;
        console.log("🧩 [FlatModule] Konstruktor: traženje top modula...");
        this.moduleName = null;
        _.forEach(netlist.modules, function (mod, name) {
            if (mod.attributes && Number(mod.attributes.top) === 1) {
                _this.moduleName = name;
            }
        });
        if (this.moduleName == null) {
            this.moduleName = Object.keys(netlist.modules)[0];
        }
        var top = netlist.modules[this.moduleName];
        console.log("\uD83D\uDD1D [FlatModule] Top modul: ".concat(this.moduleName));
        var ports = _.map(top.ports, Cell_1.default.fromPort);
        var cells = _.map(top.cells, function (c, key) { return Cell_1.default.fromYosysCell(c, key); });
        this.nodes = cells.concat(ports);
        console.log("\uD83D\uDCE6 [FlatModule] Ukupno \u010Dvorova: ".concat(this.nodes.length));
        this.wires = [];
    }
    FlatModule.prototype.addConstants = function () {
        console.log("➕ [FlatModule] Dodavanje konstantnih čvorova...");
        var maxNum = this.nodes.reduce((function (acc, v) { return v.maxOutVal(acc); }), -1);
        var signalsByConstantName = {};
        var cells = [];
        this.nodes.forEach(function (n) {
            maxNum = n.findConstants(signalsByConstantName, maxNum, cells);
        });
        this.nodes = this.nodes.concat(cells);
        console.log("\uD83D\uDD22 [FlatModule] Dodato konstanti: ".concat(cells.length));
    };
    FlatModule.prototype.addSplitsJoins = function () {
        console.log("🔀 [FlatModule] Dodavanje splits/joins...");
        var allInputs = _.flatMap(this.nodes, function (n) { return n.inputPortVals(); });
        var allOutputs = _.flatMap(this.nodes, function (n) { return n.outputPortVals(); });
        var allInputsCopy = allInputs.slice();
        var splits = {};
        var joins = {};
        allInputs.forEach(function (input) {
            gather(allOutputs, allInputsCopy, input, 0, input.length, splits, joins);
        });
        var joinCells = _.map(joins, function (joinOutput, joinInputs) {
            return Cell_1.default.fromJoinInfo(joinInputs, joinOutput);
        });
        var splitCells = _.map(splits, function (splitOutputs, splitInput) {
            return Cell_1.default.fromSplitInfo(splitInput, splitOutputs);
        });
        this.nodes = this.nodes.concat(joinCells).concat(splitCells);
        console.log("\uD83D\uDD17 [FlatModule] Splits: ".concat(Object.keys(splits).length, ", Joins: ").concat(Object.keys(joins).length));
    };
    FlatModule.prototype.createWires = function () {
        console.log("📡 [FlatModule] Kreiranje žica...");
        var layoutProps = Skin_1.default.getProperties();
        var ridersByNet = {};
        var driversByNet = {};
        var lateralsByNet = {};
        this.nodes.forEach(function (n) {
            n.collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, layoutProps.genericsLaterals);
        });
        var nets = removeDups(_.keys(ridersByNet).concat(_.keys(driversByNet)).concat(_.keys(lateralsByNet)));
        var wires = nets.map(function (net) {
            var drivers = driversByNet[net] || [];
            var riders = ridersByNet[net] || [];
            var laterals = lateralsByNet[net] || [];
            var wire = { netName: net, drivers: drivers, riders: riders, laterals: laterals };
            drivers.concat(riders).concat(laterals).forEach(function (port) {
                port.wire = wire;
            });
            return wire;
        });
        this.wires = wires;
        console.log("\uD83D\uDCEC [FlatModule] Kreirano \u017Eica: ".concat(this.wires.length));
    };
    return FlatModule;
}());
exports.FlatModule = FlatModule;
// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
function arrayToBitstring(bitArray) {
    var ret = '';
    bitArray.forEach(function (bit) {
        var sbit = String(bit);
        if (ret === '') {
            ret = sbit;
        }
        else {
            ret += ',' + sbit;
        }
    });
    return ',' + ret + ',';
}
// returns whether needle is a substring of haystack
function arrayContains(needle, haystack) {
    return (haystack.indexOf(needle) > -1);
}
// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle, arrhaystack) {
    return _.findIndex(arrhaystack, function (haystack) {
        return arrayContains(needle, haystack);
    });
}
function addToDefaultDict(dict, key, value) {
    if (dict[key] === undefined) {
        dict[key] = [value];
    }
    else {
        dict[key].push(value);
    }
}
// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring, query, start) {
    var splitStart = _.max([bitstring.indexOf(query), start]);
    var startIndex = bitstring.substring(0, splitStart).split(',').length - 1;
    var endIndex = startIndex + query.split(',').length - 3;
    if (startIndex === endIndex) {
        return String(startIndex);
    }
    else {
        return String(startIndex) + ':' + String(endIndex);
    }
}
function gather(inputs, outputs, initialToSolve, start, end, splits, joins) {
    var callStack = [{
            toSolve: initialToSolve,
            start: start,
            end: end,
            inputs: __spreadArray([], inputs, true),
            outputs: __spreadArray([], outputs, true)
        }];
    while (callStack.length > 0) {
        var ctx = callStack.pop();
        var toSolve = ctx.toSolve, inputs_1 = ctx.inputs, outputs_1 = ctx.outputs;
        var start_1 = ctx.start, end_1 = ctx.end;
        // remove from outputs
        var outputIndex = outputs_1.indexOf(toSolve);
        if (outputIndex !== -1) {
            outputs_1.splice(outputIndex, 1);
        }
        if (start_1 >= toSolve.length || end_1 - start_1 < 2) {
            continue;
        }
        var query = toSolve.slice(start_1, end_1);
        // perfect match
        if (arrayContains(query, inputs_1)) {
            if (query !== toSolve) {
                addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start_1));
            }
            callStack.push({
                toSolve: toSolve,
                start: end_1 - 1,
                end: toSolve.length,
                inputs: inputs_1,
                outputs: outputs_1
            });
            continue;
        }
        // partial match
        var index = indexOfContains(query, inputs_1);
        if (index !== -1) {
            if (query !== toSolve) {
                addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start_1));
            }
            addToDefaultDict(splits, inputs_1[index], getIndicesString(inputs_1[index], query, 0));
            var newInputs = __spreadArray(__spreadArray([], inputs_1, true), [query], false);
            callStack.push({
                toSolve: toSolve,
                start: end_1 - 1,
                end: toSolve.length,
                inputs: newInputs,
                outputs: outputs_1
            });
            continue;
        }
        // match in outputs
        if (indexOfContains(query, outputs_1) !== -1) {
            if (query !== toSolve) {
                addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start_1));
            }
            var newInputs = __spreadArray(__spreadArray([], inputs_1, true), [query], false);
            callStack.push({
                toSolve: query,
                start: 0,
                end: query.length,
                inputs: inputs_1,
                outputs: []
            });
            callStack.push({
                toSolve: toSolve,
                start: end_1 - 1,
                end: toSolve.length,
                inputs: newInputs,
                outputs: outputs_1
            });
            continue;
        }
        var lastComma = query.slice(0, -1).lastIndexOf(',');
        if (lastComma !== -1) {
            callStack.push({
                toSolve: toSolve,
                start: start_1,
                end: start_1 + lastComma + 1,
                inputs: inputs_1,
                outputs: outputs_1
            });
        }
    }
}
function removeDups(inStrs) {
    var map = {};
    inStrs.forEach(function (str) {
        map[str] = true;
    });
    return _.keys(map);
}
