"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Yosys;
(function (Yosys) {
    var ConstantVal;
    (function (ConstantVal) {
        ConstantVal["Zero"] = "0";
        ConstantVal["One"] = "1";
        ConstantVal["X"] = "x";
    })(ConstantVal || (ConstantVal = {}));
    var Direction;
    (function (Direction) {
        Direction["Input"] = "input";
        Direction["Output"] = "output";
    })(Direction = Yosys.Direction || (Yosys.Direction = {}));
    function getInputPortPids(cell) {
        var keys = Object.keys(cell.port_directions || {});
        var inputs = keys.filter(function (k) { return cell.port_directions[k] === Direction.Input; });
        console.log("\uD83D\uDFE6 Found ".concat(inputs.length, " input ports in cell of type \"").concat(cell.type, "\""));
        return inputs;
    }
    Yosys.getInputPortPids = getInputPortPids;
    function getOutputPortPids(cell) {
        var keys = Object.keys(cell.port_directions || {});
        var outputs = keys.filter(function (k) { return cell.port_directions[k] === Direction.Output; });
        console.log("\uD83D\uDFE9 Found ".concat(outputs.length, " output ports in cell of type \"").concat(cell.type, "\""));
        return outputs;
    }
    Yosys.getOutputPortPids = getOutputPortPids;
    var HideName;
    (function (HideName) {
        HideName[HideName["Hide"] = 0] = "Hide";
        HideName[HideName["NoHide"] = 1] = "NoHide";
    })(HideName || (HideName = {}));
})(Yosys || (Yosys = {}));
exports.default = Yosys;
