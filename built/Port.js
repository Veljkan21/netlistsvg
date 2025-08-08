"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Port = void 0;
var Cell_1 = require("./Cell");
var _ = require("lodash");
var Port = /** @class */ (function () {
    function Port(key, value) {
        this.key = key;
        this.value = value;
    }
    Object.defineProperty(Port.prototype, "Key", {
        get: function () {
            return this.key;
        },
        enumerable: false,
        configurable: true
    });
    Port.prototype.keyIn = function (pids) {
        return _.includes(pids, this.key);
    };
    Port.prototype.maxVal = function () {
        return _.max(_.map(this.value, function (v) { return Number(v); }));
    };
    Port.prototype.valString = function () {
        return ',' + this.value.join() + ',';
    };
    Port.prototype.findConstants = function (sigsByConstantName, maxNum, constantCollector) {
        var _this = this;
        var constNameCollector = '';
        var constNumCollector = [];
        var portSigs = this.value;
        //console.log("\uD83D\uDD0D [Port: ".concat(this.key, "] Tra\u017Eim konstante me\u0111u signalima: ").concat(portSigs));
        portSigs.forEach(function (portSig, portSigIndex) {
            if (portSig === '0' || portSig === '1') {
                maxNum += 1;
                constNameCollector += portSig;
                portSigs[portSigIndex] = maxNum;
                constNumCollector.push(maxNum);
            }
            else if (constNumCollector.length > 0) {
                _this.assignConstant(constNameCollector, constNumCollector, portSigIndex, sigsByConstantName, constantCollector);
                constNameCollector = '';
                constNumCollector = [];
            }
        });
        if (constNumCollector.length > 0) {
            this.assignConstant(constNameCollector, constNumCollector, portSigs.length, sigsByConstantName, constantCollector);
        }
        return maxNum;
    };
    Port.prototype.getGenericElkPort = function (index, templatePorts, dir) {
        var nkey = this.parentNode.Key;
        var type = this.parentNode.getTemplate()[1]['s:type'];
        //console.log("\uD83D\uDCCC [Port: ".concat(this.key, "] Elk port generisan (").concat(dir, "), index: ").concat(index, ", tip: ").concat(type));
        if (index === 0) {
            var ret = {
                id: nkey + '.' + this.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: Number(templatePorts[0][1]['s:y']),
            };
            if ((type === 'generic' || type === 'join') && dir === 'in') {
                ret.labels = [{
                        id: nkey + '.' + this.key + '.label',
                        text: this.key + (Array.isArray(this.value) && this.value.length > 1 ? " [".concat(this.value.length, "]") : ""),
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: (6 * (this.key.length + 4)),
                        height: 11,
                    }];
            }
            if ((type === 'generic' || type === 'split') && dir === 'out') {
                ret.labels = [{
                        id: nkey + '.' + this.key + '.label',
                        text: this.key + (Array.isArray(this.value) && this.value.length > 1 ? " [".concat(this.value.length, "]") : ""),
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: (6 * (this.key.length + 4)),
                        height: 11,
                    }];
            }
            return ret;
        }
        else {
            var gap = Number(templatePorts[1][1]['s:y']) - Number(templatePorts[0][1]['s:y']);
            var ret = {
                id: nkey + '.' + this.key,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: (index) * gap + Number(templatePorts[0][1]['s:y']),
            };
            if (type === 'generic') {
                ret.labels = [{
                        id: nkey + '.' + this.key + '.label',
                        text: this.key + (Array.isArray(this.value) && this.value.length > 1 ? " [".concat(this.value.length, "]") : ""),
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: (6 * (this.key.length + 4)),
                        height: 11,
                    }];
            }
            return ret;
        }
    };
    Port.prototype.assignConstant = function (nameCollector, constants, currIndex, signalsByConstantName, constantCollector) {
        var _this = this;
        var constName = nameCollector.split('').reverse().join('');
        if (signalsByConstantName.hasOwnProperty(constName)) {
            //console.log("\uD83D\uDD01 [Port: ".concat(this.key, "] Ve\u0107 vi\u0111en literal \"").concat(constName, "\", koristi stare signale."));
            var constSigs = signalsByConstantName[constName];
            var constLength_1 = constSigs.length;
            constSigs.forEach(function (constSig, constIndex) {
                var i = currIndex - constLength_1 + constIndex;
                _this.value[i] = constSig;
            });
        }
        else {
            //console.log("\uD83E\uDDEE [Port: ".concat(this.key, "] Novi literal \"").concat(constName, "\" dodeljen signalima: [").concat(constants, "]"));
            constantCollector.push(Cell_1.default.fromConstantInfo(constName, constants));
            signalsByConstantName[constName] = constants;
        }
    };
    return Port;
}());
exports.Port = Port;
