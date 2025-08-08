'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.dumpLayout = dumpLayout;
exports.render = render;
var ELK = require("elkjs");
var onml = require("onml");
var fs = require("fs"); // ✅ Dodato za pisanje fajlova
var FlatModule_1 = require("./FlatModule");
var Skin_1 = require("./Skin");
var elkGraph_1 = require("./elkGraph");
var drawModule_1 = require("./drawModule");
var elk = new ELK();

function findBitsInNetnames(yosysNetlist, name) {
    if (!yosysNetlist || !yosysNetlist.netnames || !name) return [];

    console.log("🔑 Ključevi u netnames:", Object.keys(yosysNetlist.netnames));

    const entry = yosysNetlist.netnames[name];
    if (entry && Array.isArray(entry.bits))
         return entry.bits;

    // ako nije direktno, proveri sve sa name[index]
    const bitList = [];

    for (const key in yosysNetlist.netnames) {
        if (key.startsWith(`${name}[`)) {
            const sub = yosysNetlist.netnames[key];
            if (sub && Array.isArray(sub.bits)) {
                bitList.push(...sub.bits);
            }
        }
    }

    return bitList;
}

function createFlatModule(skinData, yosysNetlist) {
    Skin_1.default.skin = onml.p(skinData);
    var layoutProps = Skin_1.default.getProperties();
    var flatModule = new FlatModule_1.FlatModule(yosysNetlist);
    if (layoutProps.constants !== false) {
        flatModule.addConstants();
    }
    if (layoutProps.splitsAndJoins !== false) {
        flatModule.addSplitsJoins();
    }
    flatModule.createWires();
    return flatModule;
}
function dumpLayout(skinData, yosysNetlist, prelayout, done) {
    var flatModule = createFlatModule(skinData, yosysNetlist);
    var kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
    // ✅ Sačuvaj ulazni graf pre layout-a
    //fs.writeFileSync('elk-input-graph.json', JSON.stringify(kgraph, null, 2), 'utf-8');
    if (prelayout) {
        done(null, JSON.stringify(kgraph, null, 2));
        return;
    }
    var layoutProps = Skin_1.default.getProperties();
    elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
        .then(function (graph) {
        // ✅ Sačuvaj ELK layout rezultat
        //fs.writeFileSync('elk-output-layout.json', JSON.stringify(graph, null, 2), 'utf-8');
        done(null, JSON.stringify(graph, null, 2));
    })
        .catch(function (reason) {
        throw Error(reason);
    });
}

function render(skinData, yosysNetlist, done, elkData, bit, bit_in) {
    //fs.writeFileSync('debug-netlist.json', JSON.stringify(yosysNetlist, null, 2), 'utf-8');


    var flatModule = createFlatModule(skinData, yosysNetlist);
    //console.log(flatModule);
    //fs.writeFileSync('flat.json', JSON.stringify(flatModule, null, 2), 'utf-8');
    var kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
    var layoutProps = Skin_1.default.getProperties();
    // ✅ Snimi ulazni graf
    //fs.writeFileSync('elk-input-graph.json', JSON.stringify(kgraph, null, 2), 'utf-8');
    var promise;
    if (elkData) {
        promise = new Promise(function (resolve) {
            (0, drawModule_1.default)(elkData, flatModule, bit,bit_in);
            resolve();
        });
    }
    else {
        console.log('Pozivam elk.layout...');
        var t0_1 = Date.now();
        promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
            .then(function (g) {
            var t1 = Date.now();
            console.log("elk.layout zavr\u0161en za ".concat((t1 - t0_1) / 1000, "s"));
            // ✅ Sačuvaj izlazni graf
            fs.writeFileSync('elk-output-layout.json', JSON.stringify(g, null, 2), 'utf-8');
            console.log('drawModule: Renderujem čvorove...');
            return (0, drawModule_1.default)(g, flatModule, bit,bit_in);
        })
            .catch(function (e) {
            console.error('Greška u elk.layout:', e);
        });
    }
    if (typeof done === 'function') {
        promise.then(function (output) {
            done(null, output);
            return output;
        }).catch(function (reason) {
            throw Error(reason);
        });
    }
    return promise;
}
