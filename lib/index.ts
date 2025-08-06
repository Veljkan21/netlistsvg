'use strict';

import ELK = require('elkjs');
import onml = require('onml');
import * as fs from 'fs'; // ✅ Dodato za pisanje fajlova

import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import Skin from './Skin';
import { ElkModel, buildElkGraph } from './elkGraph';
import drawModule from './drawModule';

const elk = new ELK();

type ICallback = (error: Error, result?: string) => void;

function createFlatModule(skinData: string, yosysNetlist: Yosys.Netlist): FlatModule {
    Skin.skin = onml.p(skinData);
    const layoutProps = Skin.getProperties();
    const flatModule = new FlatModule(yosysNetlist);
    if (layoutProps.constants !== false) {
        flatModule.addConstants();
    }
    if (layoutProps.splitsAndJoins !== false) {
        flatModule.addSplitsJoins();
    }
    flatModule.createWires();
    return flatModule;
}

export function dumpLayout(skinData: string, yosysNetlist: Yosys.Netlist, prelayout: boolean, done: ICallback) {
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph: ElkModel.Graph = buildElkGraph(flatModule);

    // ✅ Sačuvaj ulazni graf pre layout-a
    fs.writeFileSync('elk-input-graph.json', JSON.stringify(kgraph, null, 2), 'utf-8');

    if (prelayout) {
        done(null, JSON.stringify(kgraph, null, 2));
        return;
    }

    const layoutProps = Skin.getProperties();
    elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
        .then((graph: ElkModel.Graph) => {
            // ✅ Sačuvaj ELK layout rezultat
            fs.writeFileSync('elk-output-layout.json', JSON.stringify(graph, null, 2), 'utf-8');
            done(null, JSON.stringify(graph, null, 2));
        })
        .catch((reason) => {
            throw Error(reason);
        });
}

export function render(skinData: string, yosysNetlist: Yosys.Netlist, done?: ICallback, elkData?: ElkModel.Graph) {
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph: ElkModel.Graph = buildElkGraph(flatModule);
    const layoutProps = Skin.getProperties();

    // ✅ Snimi ulazni graf
    fs.writeFileSync('elk-input-graph.json', JSON.stringify(kgraph, null, 2), 'utf-8');

    let promise;

    if (elkData) {
        promise = new Promise<void>((resolve) => {
            drawModule(elkData, flatModule);
            resolve();
        });
    } else {
        console.log('Pozivam elk.layout...');
        const t0 = Date.now();

        promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
            .then((g) => {
                const t1 = Date.now();
                console.log(`elk.layout završen za ${(t1 - t0) / 1000}s`);

                // ✅ Sačuvaj izlazni graf
                fs.writeFileSync('elk-output-layout.json', JSON.stringify(g, null, 2), 'utf-8');

                console.log('drawModule: Renderujem čvorove...');
                return drawModule(g, flatModule);
            })
            .catch((e) => {
                console.error('Greška u elk.layout:', e);
            });
    }

    if (typeof done === 'function') {
        promise.then((output: string) => {
            done(null, output);
            return output;
        }).catch((reason) => {
            throw Error(reason);
        });
    }

    return promise;
}
